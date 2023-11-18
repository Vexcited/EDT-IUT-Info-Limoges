# EDT IUT Informatique of Limoges - Website

## API

The API is available at [`https://edt-iut-info-limoges.vercel.app/api`](https://edt-iut-info-limoges.vercel.app/api). `/api` will be the entrypoint for the API.

### Errors

If an error occurs, the API will return the following response.

```typescript
interface Response {
  success: false
  /** Error message in English. */
  message: string
}
```

Whenever the API doesn't return `success: false`, it means that the request was successful
and the `data` field will be present in the response.

### `GET /`

A static endpoint where the API will always return the following response.

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

Get the information list of every timetables for a given `:year`.

```typescript
interface Response {
  success: true

  data: Array<{
    /**
     * Week number from IUT's timetable, ex.: 1
     * Index starts from `1`.
     */
    week_number: number
    
    /**
     * Week number from the year, ex.: 36
     */
    week_number_in_year: number
    
    /**
     * Start date of the week (Monday) in ISO format,
     * ex.: "2023-09-04T00:00:00.000+02:00"
     */
    start_date: string
    
    /**
     * End date of the week (Saturday included, Sunday is not in the range) in ISO format,
     * ex.: "2023-09-09T00:00:00.000+02:00"
     */
    end_date: string
    
    /**
     * Last time an update was made to the timetable, in ISO format.
     * An update is when the file is modified on the **real** server.
     */
    last_update: string
  }>
}
```

### `GET /timetables/:year/:week_number`

Get the full timetable data for a given `:year` and `:week_number`.
The `:week_number` is the one given by the IUT, not the one from the year.

```typescript
interface Response {
  success: true
  data: Timetable & {
    /**
     * Last time an update was made to the timetable, in ISO format.
     * An update is when the file is modified on the **real** server.
     */
    last_update: string
  }
}
```

`Timetable` interface comes from the [`edt-iut-info-limoges` package](../library/README.md#timetable).

## Development

We're using `pnpm` as the main package manager.
Don't forget to install the dependencies using `pnpm install`.

This website only works if you've built the library first. You can do so by running `pnpm --filter edt-iut-info-limoges run build`.

Also, don't forget to fill the `MONGODB_URI` environment variable in the `.env` file. A sample has been made in `.env.sample`. MongoDB is used to store timetables to prevent requesting and extracting them too much.

| Command | Description |
| ------- | ----------- |
| `pnpm dev` | Starts the development server on [`localhost:3000`](http://localhost:3000/). |
| `pnpm build` | Build for production. |
