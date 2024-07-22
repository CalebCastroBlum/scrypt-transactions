export class Fund {
  id: string;
  name: string;

  constructor(data: Partial<Fund>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}
