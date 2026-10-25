/** What every admin server action returns (shown by ActionForm). */
export interface ActionState {
  ok?: boolean;
  message?: string;
  error?: string;
  /** Field name → message. */
  fieldErrors?: Record<string, string>;
}

export const initialActionState: ActionState = {};
