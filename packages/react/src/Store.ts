export class Store<T> {
  subscribers: Set<(state: T) => void> = new Set();

  constructor(private state: T) {}

  subscribe(callback: (state: T) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  next(value: T) {
    this.state = value;
    this.subscribers.forEach((callback) => callback(value));
  }

  getState(): T {
    return this.state;
  }
}
