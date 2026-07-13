import { Decimal } from "decimal.js";

export class Money {
  private readonly _amount: Decimal;

  /**
   * Initializes a new Money Value Object.
   * Enforces HALF_EVEN (Banker's rounding) internally for all math.
   */
  constructor(amount: number | string | Decimal) {
    // Configure Decimal.js to use Banker's rounding
    Decimal.set({ rounding: Decimal.ROUND_HALF_EVEN });
    this._amount = new Decimal(amount);
  }

  get amount(): Decimal {
    return this._amount;
  }

  /**
   * Returns value rounded to 2 decimal places for COP
   */
  toNumber(): number {
    return this._amount.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toNumber();
  }

  /**
   * Returns value as string rounded to 2 decimal places
   */
  toString(): string {
    return this._amount.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toString();
  }

  /**
   * For exact internal representation or integration tests
   */
  toExactString(): string {
    return this._amount.toString();
  }

  add(other: Money): Money {
    return new Money(this._amount.plus(other.amount));
  }

  subtract(other: Money): Money {
    return new Money(this._amount.minus(other.amount));
  }

  multiply(multiplier: number | string | Decimal): Money {
    return new Money(this._amount.times(multiplier));
  }

  divide(divisor: number | string | Decimal): Money {
    if (new Decimal(divisor).isZero()) {
      throw new Error("Division by zero");
    }
    return new Money(this._amount.dividedBy(divisor));
  }

  equals(other: Money): boolean {
    return this._amount.equals(other.amount);
  }
}
