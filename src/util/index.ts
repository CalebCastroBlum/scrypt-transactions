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
