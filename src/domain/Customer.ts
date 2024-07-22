export type IdentityDocument = {
  number: string;
  type: string;
};

export enum CustomerType {
  INDIVIDUAL = "INDIVIDUAL",
  BUSINESS = "BUSINESS",
}

export class Customer {
  id: string;
  name: string;
  type: CustomerType;
  email: string;
  identityDocuments: IdentityDocument[];

  constructor(data: Partial<Customer>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}
