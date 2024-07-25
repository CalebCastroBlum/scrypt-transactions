export const getDateAsString = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Lima",
  });
};

export const getHourAsString = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  });
};

export const currency: {
  USD: string;
  PEN: string;
} = {
  USD: "$",
  PEN: "S/.",
};

export const fundsName: { [key: string]: string } = {
  globalGrowth: "Blum Renta Global",
  globalCapital: "Blum Capital Global",
  globalCash: "Blum Cash",
  globalCashPEN: "Blum Cash Soles",
  moneyMarketUSD: "Blum Money Market Dólares",
  moneyMarketPEN: "Blum Money Market Soles",
  globalBondsUSD: "Blum Bonos Globales",
};

export const TransactionTypeName: { [key: string]: string } = {
  BUY: "Suscripción",
  SELL: "Rescate",
};

export const subTypeName: { [key: string]: string } = {
  PARTIAL: "Parcial",
  TOTAL: "Total",
};

export const TransactionStatusName: { [key: string]: string } = {
  REQUESTED: "En proceso",
  UNCONFIRMED: "Por confirmar",
  ON_HOLD: "Por firmar",
  REJECTED: "Rechazado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Completado",
};
