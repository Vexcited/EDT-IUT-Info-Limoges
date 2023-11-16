# EDT IUT Informatique of Limoges - Website

## API

The API is available at [`https://edt-iut-info-limoges.vercel.app/api`](https://edt-iut-info-limoges.vercel.app/api). `/api` will be the entrypoint for the API.

### `GET /`

Make an empty request to this endpoint and the API will always return the following response.

```typescript
interface Response {
  success: true

  data: {
    /** URL to this documentation. */
    documentation: string,
    /** Supported inputs to pass in `:year` parameter. */
    years: string[]
  }
}
```

### `GET /timetables/:year`

Get **ALL** the timetables for a given school year.

```typescript
interface Response {
  success: true

  data: {
    // TODO
  }
}
```

## Development

We're using `pnpm` as the main package manager.
Don't forget to install the dependencies using `pnpm install`.

This website only works if you've built the library first. You can do so by running `pnpm --filter edt-iut-info-limoges run build`.

Also, don't forget to fill the `MONGODB_URI` environment variable in the `.env` file. A sample has been made in `.env.sample`. MongoDB is used to store timetables to prevent requesting and extracting them too much.

| Command | Description |
| ------- | ----------- |
| `pnpm dev` | Starts the development server on [`localhost:3000`](http://localhost:3000/). |
| `pnpm build` | Build for production. |
