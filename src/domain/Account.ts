export class Account {
  id: string;

  customer: {
    id: string;
    type?: string;
    employeeId?: string;
  };

  bank: {
    id: string;
  };

  country: string;

  currency: string;

  type: string;

  number: string;

  primary: boolean;

  status: string;

  constructor(data: Partial<Account>) {
    Object.assign(this, data);
  }
}
