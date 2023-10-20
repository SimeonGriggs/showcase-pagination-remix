# Cursor-based pagination with GROQ in Remix

Paginating documents by a publishedAt dateTime field using the \_id field as a tie-breaker.

This implementation includes stateful URLs which can be shared from any "page" of results with working next and previous buttons.

[Try the demo](https://showcase-pagination-remix.vercel.app/)

## Development

From your terminal:

```sh
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

### DIY

If you're familiar with deploying node applications, the built-in Remix app server is production-ready.

Make sure to deploy the output of `remix build`

- `build/`
- `public/build/`
