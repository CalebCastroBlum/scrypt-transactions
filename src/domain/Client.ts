export class Client {
  id: string;

  name: string;

  constructor(data?: Partial<Client>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}
