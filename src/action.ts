export default interface Action {
  type: string;
}

export function isActionOfType<A extends Action>(
  action: Action,
  type: string
): action is A {
  return action.type === type;
}
