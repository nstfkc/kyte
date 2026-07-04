export class Store<T> {
  private subscribers: Set<(state: T) => void> = new Set();

  constructor(private state: T) {}

  // Arrow fields so these stay bound when passed to useSyncExternalStore.
  subscribe = (callback: (state: T) => void): (() => void) => {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  };

  next = (value: T) => {
    this.state = value;
    this.subscribers.forEach((callback) => callback(value));
  };

  getState = (): T => this.state;
}
