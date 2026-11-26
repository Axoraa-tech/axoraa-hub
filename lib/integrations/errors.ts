// Errors shared by the integration adapters and routes. Messages are plain copy that may be shown to
// an administrator; they never contain tokens, secrets or lead answers.

/** A required environment variable is missing, so the integration cannot act. */
export class IntegrationNotConfiguredError extends Error {
  readonly missing: string[];
  constructor(missing: string[], message = "This integration is not set up on the server yet.") {
    super(message);
    this.name = "IntegrationNotConfiguredError";
    this.missing = missing;
  }
}

/** The Graph API answered with an error (or could not be reached). Code 190 means the token is invalid. */
export class MetaGraphError extends Error {
  readonly code: number;
  readonly subcode: number | null;
  readonly type: string;
  readonly status: number;
  constructor(code: number, subcode: number | null, type: string, message: string, status: number) {
    super(message);
    this.name = "MetaGraphError";
    this.code = code;
    this.subcode = subcode;
    this.type = type;
    this.status = status;
  }

  get tokenInvalid(): boolean {
    return this.code === 190;
  }
}

/** The operation exists in the interface but is not built for this channel or reporter. */
export class UnsupportedOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedOperationError";
  }
}
