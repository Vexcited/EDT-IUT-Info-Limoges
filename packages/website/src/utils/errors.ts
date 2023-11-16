export enum APIErrorType {
  NOT_FOUND = "NOT_FOUND",
  NO_CACHE = "NO_CACHE"
}

const APIErrorMessages = {
  [APIErrorType.NOT_FOUND]: "L'EDT demandé n'existe pas ou alors pas encore.",
  [APIErrorType.NO_CACHE]: "Pas de cache disponible pour l'EDT demandé, revenez en ligne pour l'obtenir et/ou le mettre à jour."
};

export class APIError extends Error {
  public type: APIErrorType;
  public message: string;

  constructor(type: APIErrorType) {
    const message = APIErrorMessages[type];
    super(message);

    this.type = type;
    this.message = message;
  }
}
