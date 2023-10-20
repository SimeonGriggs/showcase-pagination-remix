import { json, type LoaderFunction, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import type { SanityDocument } from "@sanity/client";
import { format } from "date-fns";
import React from "react";

import { client } from "~/sanity/client";

export const meta: MetaFunction = () => {
  return [{ title: "Showcase Pagination" }];
};

const DEFAULT_PER_PAGE = "3";

export const loader: LoaderFunction = async ({ request }) => {
  let allLessons = await client.fetch<SanityDocument[]>(
    `*[_type == "lesson"]|order(publishedAt desc, _id desc)`,
  );

  const requestUrl = new URL(request.url);
  const searchParams = new URLSearchParams(requestUrl.search);
  const params = {
    cursor: {
      firstId: searchParams.get("firstId"),
      firstPublishedAt: searchParams.get("firstPublishedAt"),
      lastId: searchParams.get("lastId"),
      lastPublishedAt: searchParams.get("lastPublishedAt"),
    },
    perPage: parseInt(searchParams.get("perPage") ?? DEFAULT_PER_PAGE, 10),
  };

  const query = /* groq */ `*[
    _type == "lesson"
    // Must ensure the field exists as sorting on undefined or null values could yield unexpected results
    && defined(publishedAt)

    && select(
      // If first cursor is defined, get $perPage+1 items INCLUDING AND AFTER it in reverse order!
      (defined($cursor.firstPublishedAt) && defined($cursor.firstId)) => 
        dateTime(publishedAt) > dateTime($cursor.firstPublishedAt) 
        || (dateTime(publishedAt) == dateTime($cursor.firstPublishedAt) && _id > $cursor.firstId),
      // If last cursor is defined, get $perPage+1 items AFTER lastPublishedAt
      (defined($cursor.lastPublishedAt) && defined($cursor.lastId)) => 
        dateTime(publishedAt) < dateTime($cursor.lastPublishedAt) 
        || (dateTime(publishedAt) == dateTime($cursor.lastPublishedAt) && _id < $cursor.lastId),
      // No pagination cursor, then no additional filtering
      true
    )
  ] 
  // Unfortunately I couldn't do conditional ordering, so we're using JS to flip the order
  // Order-flipping is required when we have a $firstId
  | order(publishedAt ${params.cursor.firstPublishedAt ? `asc` : `desc`}, _id ${
    params.cursor.firstPublishedAt ? `asc` : `desc`
  }) 
  // Fetch one more to work out if we have a next page
  [0...$perPage + 1]
  // If reverse ordered, flip-back, newest-to-oldest
  | order(publishedAt desc, _id desc)`;

  let lessons = await client.fetch<SanityDocument[]>(query, params);

  // I'd imagine there's a simpler way to do this logic, but I like specificity
  const hasPrevPage =
    // Cannot be true if there are no cursors
    (!params.cursor.firstId && !params.cursor.lastId) ||
    // Query has a lastId
    (!params.cursor.firstId && params.cursor.lastId) ||
    // We have a firstId cursor, so results were queried backwards and there is an additional, previous lesson
    (params.cursor.firstId && lessons.length > params.perPage);

  const hasNextPage =
    // There are no cursors but there is an additional lesson
    (!params.cursor.firstId &&
      !params.cursor.lastId &&
      lessons.length > params.perPage) ||
    // We only have a lastId cursor, so results were queried forwards and there are more than $perPage lessons
    (params.cursor.lastId &&
      !params.cursor.firstId &&
      lessons.length > params.perPage) ||
    // If we have a firstId cursor
    !!params.cursor.firstId;

  // If an extra lesson was found
  if (lessons.length > params.perPage) {
    lessons = params.cursor.firstId
      ? // remove first item
        lessons.slice(1, params.perPage + 1)
      : // remove last item otherwise
        lessons.slice(0, params.perPage);
  }

  return json({
    allLessons,
    lessons,
    perPage: params.perPage,
    hasPrevPage,
    prevCursor: hasPrevPage
      ? {
          firstId: lessons[0]?._id,
          firstPublishedAt: lessons[0]?.publishedAt,
        }
      : null,
    hasNextPage,
    nextCursor: hasNextPage
      ? {
          lastId: lessons[lessons.length - 1]?._id,
          lastPublishedAt: lessons[lessons.length - 1]?.publishedAt,
        }
      : null,
  });
};

export default function Index() {
  const {
    allLessons,
    lessons,
    perPage,
    hasPrevPage,
    hasNextPage,
    prevCursor,
    nextCursor,
  } = useLoaderData<typeof loader>();

  const [searchParams, setSearchParams] = useSearchParams();

  const handlePagination = (event: React.MouseEvent<HTMLButtonElement>) => {
    const { name } = event.currentTarget;

    switch (name) {
      case "reset":
        setSearchParams((prev) => {
          prev.delete("lastId");
          prev.delete("lastPublishedAt");
          prev.delete("firstId");
          prev.delete("firstPublishedAt");
          prev.delete("perPage");

          return prev;
        });

        break;
      case "next":
        setSearchParams((prev) => {
          prev.set("lastId", nextCursor.lastId);
          prev.set("lastPublishedAt", nextCursor.lastPublishedAt);
          prev.delete("firstId");
          prev.delete("firstPublishedAt");

          return prev;
        });

        break;
      case "prev":
        setSearchParams((prev) => {
          prev.set("firstId", prevCursor.firstId);
          prev.set("firstPublishedAt", prevCursor.firstPublishedAt);
          prev.delete("lastId");
          prev.delete("lastPublishedAt");

          return prev;
        });

        break;
      case "perPage":
        setSearchParams((prev) => {
          prev.set("perPage", event.currentTarget.value);
          prev.delete("lastId");
          prev.delete("lastPublishedAt");
          prev.delete("firstId");
          prev.delete("firstPublishedAt");

          return prev;
        });
        break;
      default:
        break;
    }
  };

  return (
    <div className="container mx-auto grid grid-cols-5 items-start gap-24 p-12">
      <div className="prose prose-xl col-span-2">
        <h2>Cursor-based pagination with GROQ in Remix</h2>
        <p>
          Paginating documents by a <code>publishedAt</code> dateTime field
          using the <code>_id</code> field as a tie-breaker.
        </p>
        <p>
          This implementation includes stateful URLs which can be shared from
          any 'page' of results with working next and previous buttons.
        </p>
        <ul>
          <li>
            <a href="https://www.sanity.io/docs/paginating-with-groq">
              Read the docs on Sanity.io
            </a>
          </li>
          <li>
            See also:{" "}
            <a href="https://brunoscheufler.com/blog/2022-01-01-paginating-large-ordered-datasets-with-cursor-based-pagination">
              Paginating Large, Ordered Data Sets with Cursor-Based Pagination
            </a>
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-4 col-span-2">
        <div className="flex items-center justify-between">
          <button
            disabled={!hasPrevPage}
            name="prev"
            onClick={handlePagination}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:pointer-events-none disabled:opacity-50"
          >
            &larr; Prev (Newer)
          </button>
          <button
            name="reset"
            onClick={handlePagination}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:pointer-events-none disabled:opacity-50"
          >
            Reset
          </button>
          <button
            disabled={!hasNextPage}
            name="next"
            onClick={handlePagination}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:pointer-events-none disabled:opacity-50"
          >
            Next (Older) &rarr;
          </button>
        </div>
        {lessons?.length > 0 ? (
          <ul className="grid grid-cols-1 gap-1 py-1">
            {lessons.map((lesson) => (
              <li key={lesson._id} className="rounded bg-blue-50 text-blue-900">
                <div className="flex justify-between items-center py-6 px-8 font-mono leading-none">
                  <div>{lesson._id}</div>
                  <div>
                    {format(new Date(lesson.publishedAt), "dd/MM/yyyy")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="bg-red-50 text-red-900 rounded-lg">
            <div className="flex justify-between items-center py-6 px-8 font-mono leading-none">
              No lessons found
            </div>
          </div>
        )}
        <hr />
        <p>Current perPage setting:</p>
        <div className="flex items-center justify-between gap-1">
          {[2, 3, 4, 5, 8, 10, 12].map((value) => (
            <button
              key={value}
              name="perPage"
              onClick={handlePagination}
              className={[
                `bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded`,
                perPage === value ? `bg-blue-900` : `bg-blue-500`,
              ].join(` `)}
              value={value}
            >
              {value}
            </button>
          ))}
        </div>
        <hr />
        <p>Current query params:</p>
        <pre>
          {JSON.stringify(Object.fromEntries(searchParams.entries()), null, 2)}
        </pre>
      </div>

      <div className="col-span-1 grid">
        {allLessons.map((lesson, lessonIndex) => {
          const inPaginatedResults = lessons
            .map((l) => l._id)
            .includes(lesson._id);
          const wasCursor =
            searchParams.get("lastId") === lesson._id ||
            searchParams.get("firstId") === lesson._id;

          return (
            <React.Fragment key={lesson._id}>
              <div
                className={[
                  `text-xs font-mono rounded text-center border-b border-white`,
                  inPaginatedResults
                    ? `bg-blue-100 text-blue-900 py-1`
                    : wasCursor
                    ? `bg-yellow-100 text-yellow-900 py-1`
                    : `bg-gray-50 text-gray-300`,
                ].join(` `)}
              >
                {lesson._id}
              </div>
              {/* Insert divider if lessonIndex is a multiple of perPage */}
              {lessonIndex % perPage === perPage - 1 ? (
                <div className="py-1.5" />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
