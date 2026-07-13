import { Decimal } from "decimal.js";

export enum FiscalRoundingStrategy {
  HALF_UP = Decimal.ROUND_HALF_UP,
  HALF_EVEN = Decimal.ROUND_HALF_EVEN,
  DOWN = Decimal.ROUND_DOWN,
  UP = Decimal.ROUND_UP,
}

export class FiscalRoundingPolicy {
  constructor(
    public readonly strategy: FiscalRoundingStrategy = FiscalRoundingStrategy.HALF_UP,
    public readonly precision: number = 2,
  ) {}
}

export class Money {
  private readonly _amount: Decimal;
  private readonly policy: FiscalRoundingPolicy;

  /**
   * Initializes a new Money Value Object.
   * Enforces specific rounding strategy internally without mutating global Decimal.
   * Prohibits `number` to prevent IEEE 754 float precision loss.
   */
  constructor(amount: string | Decimal | Money, policy?: FiscalRoundingPolicy) {
    if (typeof amount === "number") {
      throw new Error("Initializing Money with a float/number is forbidden. Use string or Decimal to prevent precision loss.");
    }
    
    this.policy = policy || new FiscalRoundingPolicy();
    
    if (amount instanceof Money) {
      this._amount = new Decimal(amount._amount);
    } else {
      this._amount = new Decimal(amount);
    }
  }

  get amount(): Decimal {
    return this._amount;
  }

  get currentPolicy(): FiscalRoundingPolicy {
    return this.policy;
  }

  /**
   * Returns value rounded according to the fiscal policy.
   * Useful for final XML serialization.
   */
  toString(): string {
    return this._amount.toDecimalPlaces(this.policy.precision, this.policy.strategy as Decimal.Rounding).toString();
  }

  /**
   * For exact internal representation or database persistence (if numeric).
   */
  toExactString(): string {
    return this._amount.toString();
  }

  /**
   * Returns a string representation of the value rounded to the specified number of decimal places, padded with zeros if necessary.
   */
  toFixed(fractionalDigits: number = 2): string {
    return this._amount.toFixed(fractionalDigits, this.policy.strategy as Decimal.Rounding);
  }

  add(other: Money): Money {
    return new Money(this._amount.plus(other.amount), this.policy);
  }

  subtract(other: Money): Money {
    return new Money(this._amount.minus(other.amount), this.policy);
  }

  multiply(multiplier: string | Decimal): Money {
    if (typeof multiplier === "number") {
      throw new Error("Multiplication with a float/number is forbidden.");
    }
    return new Money(this._amount.times(multiplier), this.policy);
  }

  divide(divisor: string | Decimal): Money {
    if (typeof divisor === "number") {
      throw new Error("Division by a float/number is forbidden.");
    }
    if (new Decimal(divisor).isZero()) {
      throw new Error("Division by zero");
    }
    return new Money(this._amount.dividedBy(divisor), this.policy);
  }

  equals(other: Money): boolean {
    // Check equality on the rounded amount
    const thisRounded = this._amount.toDecimalPlaces(this.policy.precision, this.policy.strategy as Decimal.Rounding);
    const otherRounded = other.amount.toDecimalPlaces(this.policy.precision, this.policy.strategy as Decimal.Rounding);
    return thisRounded.equals(otherRounded);
  }
}
