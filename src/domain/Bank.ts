export class Bank {
  id: string;
  name: string;

  constructor(data: Partial<Bank>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}
