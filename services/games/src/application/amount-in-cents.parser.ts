import { BadRequestException } from "@nestjs/common";

const AMOUNT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

export function parseAmountInCents(value: string): number {
  const normalizedValue = value.trim();

  if (!AMOUNT_PATTERN.test(normalizedValue)) {
    throw new BadRequestException(
      "Amount must be a decimal string with up to two fraction digits",
    );
  }

  const [unitsPart, centsPart = ""] = normalizedValue.split(".");
  const units = Number.parseInt(unitsPart, 10);
  const cents = Number.parseInt(centsPart.padEnd(2, "0"), 10);
  const total = units * 100 + cents;

  if (!Number.isSafeInteger(total) || total < 0) {
    throw new BadRequestException("Amount is out of range");
  }

  return total;
}
