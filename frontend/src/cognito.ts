import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  type CognitoUserSession,
} from "amazon-cognito-identity-js";

const poolId = import.meta.env.VITE_COGNITO_USER_POOL_ID ?? "";
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID ?? "";

export const cognitoEnabled = Boolean(poolId && clientId);

function pool(): CognitoUserPool {
  return new CognitoUserPool({ UserPoolId: poolId, ClientId: clientId });
}

function cognitoErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

export function isAlreadyConfirmedError(err: unknown): boolean {
  const message = cognitoErrorMessage(err);
  return /already confirmed|current status is confirmed/i.test(message);
}

function cognitoMessage(err: unknown): string {
  const message = cognitoErrorMessage(err);
  if (isAlreadyConfirmedError(err)) {
    return "Your email is already confirmed. Enter your password and open your shop.";
  }
  if (message.includes("UserNotConfirmedException")) {
    return "Your account is not active yet. If you signed up before, contact podimart.lk support.";
  }
  if (message.includes("NotAuthorizedException") || message.includes("UserNotFound")) {
    return "Email or password is wrong.";
  }
  if (message.includes("UsernameExistsException") || /user already exists/i.test(message)) {
    return "This email is already registered. Log in instead, or use Forgot password if you need help.";
  }
  if (message.includes("CodeMismatch") || message.includes("ExpiredCode")) {
    return "That code is wrong or expired. Request a new one.";
  }
  if (message.includes("InvalidPassword")) {
    return "Password must be at least 8 characters.";
  }
  return message;
}

export function signUpCognito(email: string, password: string, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const attrs = [
      new CognitoUserAttribute({ Name: "email", Value: email }),
      new CognitoUserAttribute({ Name: "name", Value: name }),
    ];
    pool().signUp(email, password, attrs, [], (err) => {
      if (err) reject(new Error(cognitoMessage(err)));
      else resolve();
    });
  });
}

export function confirmCognito(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool() });
    user.confirmRegistration(code, true, (err) => {
      if (err) {
        if (isAlreadyConfirmedError(err)) {
          resolve();
          return;
        }
        reject(new Error(cognitoMessage(err)));
        return;
      }
      resolve();
    });
  });
}

export function resendCognitoCode(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool() });
    user.resendConfirmationCode((err) => {
      if (err) {
        if (isAlreadyConfirmedError(err)) {
          reject(new Error(cognitoMessage(err)));
          return;
        }
        reject(new Error(cognitoMessage(err)));
        return;
      }
      resolve();
    });
  });
}

export function signInCognito(email: string, password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool() });
    user.authenticateUser(new AuthenticationDetails({ Username: email, Password: password }), {
      onSuccess(session: CognitoUserSession) {
        resolve(session.getIdToken().getJwtToken());
      },
      onFailure(err: Error) {
        reject(new Error(cognitoMessage(err)));
      },
    });
  });
}

export function signOutCognito(): void {
  pool().getCurrentUser()?.signOut();
}

export function getCognitoToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const user = pool().getCurrentUser();
    if (!user) {
      resolve(null);
      return;
    }
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) resolve(null);
      else resolve(session.getIdToken().getJwtToken());
    });
  });
}
