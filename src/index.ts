import puppeteer from "puppeteer";
import {
  getTransactionFromDynamoDb,
  getTransactionDb,
  getCustomer,
  getFundFromDynamoDb,
  getBankFromLambda,
  getAccountFromLambda,
  getClientFromLambda,
  getTransactionByStartAndEndDate,
  makeCustomersCsv,
  makeCustomerPDF,
  getPivoltTransaction,
  getPivoltApiTransaction,
} from "./repository";

import { getDateAsString, getHourAsString, currency } from "./util";

import {
  createBuyTemplate,
  type createBuyTemplateType,
  createSellTemplate,
  type createSellTemplateType,
} from "./templates";
import { Customer, CustomerType } from "./domain/Customer";
import { Fund } from "./domain/Fund";
import { TransactionType } from "./domain/Transaction";
import { Bank } from "./domain/Bank";
import { Client } from "./domain/Client";
import { Account } from "./domain/Account";
import * as path from "path";
import * as fs from "fs";

export const ENV: "Prod" | "Dev" = "Prod";
const typeTransaction = {
  PARTIAL: "Parcial",
  TOTAL: "Total",
};

// Tomar screenshot
const takeScreenshot = async (archive: string, html: string) => {
  const screenshotDir = path.resolve("./images");

  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  await page.screenshot({
    path: path.join(screenshotDir, archive),
    fullPage: true,
  });

  await browser.close();
};

const transformTransaction = async (
  transaction: any
): Promise<{
  html: string;
  archive: string;
  data: createBuyTemplateType | createSellTemplateType;
}> => {
  const customer = new Customer(await getCustomer(transaction.customerId));
  const fund = new Fund(await getFundFromDynamoDb(transaction?.fund.id));

  switch (customer.type) {
    case CustomerType.INDIVIDUAL: {
      if (transaction.type === TransactionType.BUY) {
        const data = {
          NAME: customer.name,
          FUND_NAME: fund.name,
          DATE: getDateAsString(transaction.creationDate),
          HOUR: getHourAsString(transaction.creationDate),
          AMOUNT: `${currency[transaction.currency]} ${transaction.amount}`,
          TRANSACTION_ID: transaction.origin.bank.transaction.id || "",
          BANK_NAME: new Bank(
            await getBankFromLambda(transaction.origin.bank.id)
          ).name,
          EMAIL: customer.email,
          FULL_NAME: `${customer.name} ${customer.middleName ?? ""} ${
            customer.lastName ?? ""
          } ${customer.motherLastName ?? ""} `,
          CUSTOMER_TYPE: customer.type,
          DOCUMENT_NUMBER: customer.identityDocuments[0].number,
          DOCUMENT_TYPE: customer.identityDocuments[0].type,
          STATUS: transaction.status,
        } as createBuyTemplateType;
        return {
          html: createBuyTemplate(data),
          archive: `${customer.identityDocuments[0].number}_${transaction.creationDate}.png`,
          data,
        };
      }

      if (transaction.type === TransactionType.SELL) {
        let account: Account;
        let isRescueByAmount: boolean = false;
        let isRescueByShares: boolean = false;
        let isRescueTotal: boolean = false;

        if (transaction.subType === "PARTIAL") {
          let pivolt = await getPivoltTransaction(transaction.transactionId);
          let pivoltData = await getPivoltApiTransaction(pivolt.pivoltId);
          switch (pivoltData.TransactionTypeDetail) {
            case "Redemption_Shares": {
              isRescueByShares = true;
              break;
            }
            case "Redemption_Full": {
              isRescueTotal = true;
              break;
            }
            case "Redemption_NetAmount": {
              isRescueByAmount = true;
              break;
            }
          }
        }

        if (!transaction.clientId) {
          account = await getAccountFromLambda(
            transaction.destiny.account.id,
            customer
          );
        }

        const data = {
          NAME: customer.name,
          FUND_NAME: fund.name,
          DATE: getDateAsString(transaction.creationDate),
          TIME: getHourAsString(transaction.creationDate),
          SUBTYPE: typeTransaction[transaction.subType],
          AMOUNT: isRescueByAmount
            ? `${currency[transaction.currency]} ${transaction.amount}`
            : "-",
          ACCOUNT: transaction.clientId ? " - " : account.number,
          SHARES: isRescueByShares ? transaction.shares : "-",
          SETTLEMENT_DATE: getDateAsString(transaction.settlementDate),
          BANK_NAME: transaction.clientId
            ? new Client(await getClientFromLambda(transaction.clientId)).name
            : new Bank(await getBankFromLambda(account.bank.id)).name,
          EMAIL: customer.email,
          FULL_NAME: `${customer.name} ${customer.middleName ?? ""} ${
            customer.lastName ?? ""
          } ${customer.motherLastName ?? ""} `,
          CUSTOMER_TYPE: customer.type,
          DOCUMENT_NUMBER: customer.identityDocuments[0].number,
          DOCUMENT_TYPE: customer.identityDocuments[0].type,
          STATUS: transaction.status,
          isRescueByAmount,
          isRescueByShares,
          isRescueTotal,
        } as createSellTemplateType;

        return {
          html: createSellTemplate(data),
          archive: `${customer.identityDocuments[0].number}_${transaction.creationDate}.png`,
          data,
        };
      }
      break;
    }
    case CustomerType.BUSINESS: {
      if (transaction.type === TransactionType.BUY) {
        const data = {
          NAME: customer.name,
          FUND_NAME: fund.name,
          DATE: getDateAsString(transaction.creationDate),
          HOUR: getHourAsString(transaction.creationDate),
          AMOUNT: `${currency[transaction.currency]} ${transaction.amount}`,
          TRANSACTION_ID: "",
          BANK_NAME: new Bank(
            await getBankFromLambda(transaction.origin.bank.id)
          ).name,
          EMAIL: customer.email,
          FULL_NAME: `${customer.name} ${customer.middleName ?? ""} ${
            customer.lastName ?? ""
          } ${customer.motherLastName ?? ""} `,
          CUSTOMER_TYPE: customer.type,
          DOCUMENT_NUMBER: customer.identityDocuments[0].number,
          DOCUMENT_TYPE: customer.identityDocuments[0].type,
          STATUS: transaction.status,
        } as createBuyTemplateType;

        return {
          html: createBuyTemplate(data),
          archive: `${customer.identityDocuments[0].number}_${transaction.creationDate}.png`,
          data,
        };
      }

      if (transaction.type === TransactionType.SELL) {
        let isRescueByAmount: boolean = false;
        let isRescueByShares: boolean = false;
        let isRescueTotal: boolean = false;
        if (transaction.subType === "PARTIAL") {
          let pivolt = await getPivoltTransaction(transaction.transactionId);
          let pivoltData = await getPivoltApiTransaction(pivolt.pivoltId);
          switch (pivoltData.TransactionTypeDetail) {
            case "Redemption_Shares": {
              isRescueByShares = true;
              break;
            }
            case "Redemption_Full": {
              isRescueTotal = true;
              break;
            }
            case "Redemption_NetAmount": {
              isRescueByAmount = true;
              break;
            }
          }
        }
        const account = await getAccountFromLambda(
          transaction.destiny.account.id,
          customer
        );

        console.log("SETTLEMENT_DATE", { date: transaction.settlementDate });

        const data = {
          NAME: customer.name,
          FUND_NAME: fund.name,
          DATE: getDateAsString(transaction.creationDate),
          TIME: getHourAsString(transaction.creationDate),
          SUBTYPE: typeTransaction[transaction.subType],
          AMOUNT: isRescueByAmount
            ? `${currency[transaction.currency]} ${transaction.amount}`
            : "-",
          ACCOUNT: account.number,
          SETTLEMENT_DATE: "Pendiente de aprobación",
          BANK_NAME: new Bank(await getBankFromLambda(account.bank.id)).name,
          SHARES: isRescueByShares ? transaction.shares : "-",
          EMAIL: customer.email,
          FULL_NAME: `${customer.name} ${customer.middleName ?? ""} ${
            customer.lastName ?? ""
          } ${customer.motherLastName ?? ""} `,
          CUSTOMER_TYPE: customer.type,
          DOCUMENT_NUMBER: customer.identityDocuments[0].number,
          DOCUMENT_TYPE: customer.identityDocuments[0].type,
          STATUS: transaction.status,
          isRescueByAmount,
          isRescueByShares,
          isRescueTotal,
        } as createSellTemplateType;
        return {
          html: createSellTemplate(data),
          archive: `${customer.identityDocuments[0].number}_${transaction.creationDate}.png`,
          data,
        };
      }
      break;
    }
    default: {
      throw new Error("Customer type not found");
    }
  }
};

const main = async ({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) => {
  // const transactions = await getTransactionByStartAndEndDate({
  //   startDate,
  //   endDate,
  // });

  const data = [
    {
      transactionId: "34f5d550-2f87-11ed-b8ba-1f2b61e97365",
      customerId: "1b2a57ad-7ea6-4bc4-8c33-5b5bf2741afd",
    },
    {
      transactionId: "49680a90-3a85-11ed-8246-79a1eaf8d1a3",
      customerId: "5bd49bb3-3b8f-40f3-833d-2a48c46f772d",
    },
    {
      transactionId: "a84bb460-69ee-11ed-bcb9-4d00687aeb95",
      customerId: "d9bc97d4-e167-4719-96ba-1947839df9c4",
    },
    {
      transactionId: "d1759d00-dfc9-11ed-a634-1b94bd34603d",
      customerId: "beb6a8a4-f51b-4bba-b9a2-5d0e1a9c0171",
    },
    {
      transactionId: "8f0342d0-2fd1-11ee-bbe5-57d12244bcc1",
      customerId: "b62e1a26-8c01-4278-9d9f-98ef73a62b3f",
    },
    {
      transactionId: "4957f176-a831-4561-9b3d-2ddfef6ede6a",
      customerId: "2a5b2045-debe-49fd-b97b-b91550572fb1",
    },
    {
      transactionId: "020ed5ff-cb2f-4034-bb79-1b4b8a29c342",
      customerId: "513c450b-1f00-4805-93cb-38cb3a253998",
    },
    {
      transactionId: "46fbb080-fbf2-11ec-8089-1d94f3f08ed8",
      customerId: "d14a1d7e-bdf6-411c-8461-658c1518d694",
    },
    {
      transactionId: "07fcc540-7c99-11ed-9188-2b40f67ea7e6",
      customerId: "0f4a051b-6f63-4f1c-9aa4-27edac8c1547",
    },
    {
      transactionId: "73445010-86db-11ed-ba74-61b69b5412dd",
      customerId: "77fe4700-7024-11ed-93a9-ff48dda71b4a",
    },
    {
      transactionId: "201129f0-b2f9-11ed-a6d2-e716aa88a6bb",
      customerId: "8b0eeb88-5ebb-4641-a084-3e969c365a0f",
    },
    {
      transactionId: "2143c8d0-a012-11ee-b766-4988814ce894",
      customerId: "f952605a-2d44-497d-aeae-511ff92935cc",
    },
    {
      transactionId: "595eedee-569a-4f04-b947-96c552d8709b",
      customerId: "8babf818-40e0-4641-8b74-5972d9171795",
    },
    {
      transactionId: "aec68345-fc49-49dc-b26f-28d21fb5b0c2",
      customerId: "3b89dd91-30d6-4cf6-8b17-e2f21a08e0ff",
    },
    {
      transactionId: "3240b120-e8f7-11ed-b2ef-894e5b2d5067",
      customerId: "cbda17cc-0dc7-4ec8-9c93-a3fcedf3ccaa",
    },
    {
      transactionId: "048b5d60-0950-11ee-8742-27cdd0561edf",
      customerId: "61935320-0705-11ee-b055-e987a35695f0",
    },
    {
      transactionId: "fa882e90-506d-4aec-9390-d8e191e225e2",
      customerId: "63be5e1b-e34e-43af-ba36-e8e3b166cb1c",
    },
    {
      transactionId: "01dc9f62-d0c2-4a25-8ec3-f0271852c99e",
      customerId: "dce06641-3e86-489e-8de7-0bf95f0e558f",
    },
    {
      transactionId: "724a5aa1-d78b-49f4-8599-d6e808c5b2a8",
      customerId: "e4726144-9926-461b-9dcf-f43b108cece9",
    },
    {
      transactionId: "6f2056d6-7c4e-4ace-bb6e-4e27753a4a0a",
      customerId: "b01fc999-dc2d-4aad-acbd-18aa8f156c61",
    },
    {
      transactionId: "05045170-9589-11ec-a9cc-d15fbcd39aa9",
      customerId: "5536d199-dcac-4030-96fb-30c2ada5be8e",
    },
    {
      transactionId: "32ebbb60-a6f9-11ec-9b2d-79ea721f0a5c",
      customerId: "963ff270-4346-4460-b9ff-cfc8259c3a7f",
    },
    {
      transactionId: "f8bf0a60-e2cf-11ec-b4cb-9fd81f35fb91",
      customerId: "1b961e65-36d9-428e-9ff1-e44711ff7eee",
    },
    {
      transactionId: "b1d481c0-1b6e-11ed-833b-f53ef1628bba",
      customerId: "bd2e3390-fb91-4429-9a68-7b1d4a608c22",
    },
    {
      transactionId: "eb9f4740-95ef-11ed-adf3-2dbb2935cc89",
      customerId: "493b368d-46ea-4e23-baf1-b9ed2bedd747",
    },
    {
      transactionId: "fb566fa0-faf9-11ed-a808-69dedf86bd99",
      customerId: "c9c624ac-b09b-4e04-a77a-4e10672d725d",
    },
    {
      transactionId: "3f4c3cd0-62ce-11ee-8f87-975747a24d48",
      customerId: "af509205-0437-4de4-973c-b823032c0682",
    },
    {
      transactionId: "f3c66370-a36a-11ee-b035-ef4cf1240019",
      customerId: "913b3b29-632e-417f-a56d-564b85813242",
    },
    {
      transactionId: "bd97659a-b68c-42f3-8246-d97b330519d4",
      customerId: "bdf11275-d6a0-4629-a4a2-591360c9812f",
    },
    {
      transactionId: "40cd1e93-e335-4513-b5bb-96cc9c9ead61",
      customerId: "c24f7bc5-a425-4759-8718-8f6c8e4d1613",
    },
  ];

  const transactions = await Promise.all(
    data.map(async ({ customerId, transactionId }) => {
      const response = await getTransactionDb({
        transactionId,
        customerId,
      });

      console.log({ response });
      return {
        ...response,
        transactionId: response.id,
        typeTransaction: response.type,
        customerId: response.customerId,
      };
    })
  );

  console.log("OK", `total transactions: ${transactions.length}`);

  const transactionsWithData = await Promise.all(
    transactions.map(async (t) => {
      // const { data, html, archive } = await getData(t.transactionId);
      const { data, html, archive } = await transformTransaction(t);

      await takeScreenshot(archive, html);
      return {
        ...t,
        ...data,
        archive,
        html,
        emailBlum: "Blum <noreply@miblum.com>",
      };
    })
  );

  console.log("OK", `transactionsWithData`);

  // await makeCustomersCsv({
  //   transactions: transactionsWithData,
  //   path: "output.csv",
  // });

  await makeCustomerPDF({
    transactions: transactionsWithData,
    path: "output.pdf",
  });
  console.log("Done");
};

/* main({
  startDate: "2024-07-01",
  endDate: "2024-07-31",
}); */
