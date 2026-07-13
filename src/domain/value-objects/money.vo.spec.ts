import { Money, FiscalRoundingPolicy, FiscalRoundingStrategy } from "./money.vo";
import { Decimal } from "decimal.js";

describe("Money & FiscalRoundingPolicy", () => {
  describe("Initialization", () => {
    it("should initialize from a string", () => {
      const money = new Money("100.55");
      expect(money.toExactString()).toBe("100.55");
    });

    it("should initialize from a Decimal", () => {
      const money = new Money(new Decimal("200.11"));
      expect(money.toExactString()).toBe("200.11");
    });

    it("should initialize from another Money instance", () => {
      const original = new Money("300.99");
      const copy = new Money(original);
      expect(copy.toExactString()).toBe("300.99");
    });

    it("should throw when initialized with a number to prevent precision loss", () => {
      expect(() => new Money(100.55 as any)).toThrow(/forbidden/);
    });
  });

  describe("Arithmetic operations", () => {
    it("should add two Money objects exactly", () => {
      const m1 = new Money("10.123");
      const m2 = new Money("20.345");
      const result = m1.add(m2);
      expect(result.toExactString()).toBe("30.468");
    });

    it("should subtract two Money objects exactly", () => {
      const m1 = new Money("100.55");
      const m2 = new Money("50.11");
      const result = m1.subtract(m2);
      expect(result.toExactString()).toBe("50.44");
    });

    it("should multiply by a string/Decimal factor", () => {
      const m = new Money("10.50");
      const result = m.multiply("2.5");
      expect(result.toExactString()).toBe("26.25");
    });

    it("should throw when multiplying by a number", () => {
      const m = new Money("10");
      expect(() => m.multiply(2 as any)).toThrow(/forbidden/);
    });

    it("should divide by a string/Decimal factor", () => {
      const m = new Money("100");
      const result = m.divide("3");
      expect(result.toExactString()).toBe("33.333333333333333333");
    });

    it("should throw when dividing by zero", () => {
      const m = new Money("100");
      expect(() => m.divide("0")).toThrow(/zero/);
    });

    it("should throw when dividing by a number", () => {
      const m = new Money("100");
      expect(() => m.divide(2 as any)).toThrow(/forbidden/);
    });
  });

  describe("Rounding Policy", () => {
    it("should use HALF_UP by default", () => {
      const money = new Money("10.555");
      expect(money.toString()).toBe("10.56");

      const money2 = new Money("10.554");
      expect(money2.toString()).toBe("10.55");
    });

    it("should apply HALF_EVEN rounding if specified", () => {
      const policy = new FiscalRoundingPolicy(FiscalRoundingStrategy.HALF_EVEN, 2);
      
      // 10.555 -> 10.56 (nearest even)
      const m1 = new Money("10.555", policy);
      expect(m1.toString()).toBe("10.56");

      // 10.545 -> 10.54 (nearest even)
      const m2 = new Money("10.545", policy);
      expect(m2.toString()).toBe("10.54");
    });

    it("should apply DOWN rounding if specified", () => {
      const policy = new FiscalRoundingPolicy(FiscalRoundingStrategy.DOWN, 2);
      const money = new Money("10.559", policy);
      expect(money.toString()).toBe("10.55");
    });

    it("should apply custom precision", () => {
      const policy = new FiscalRoundingPolicy(FiscalRoundingStrategy.HALF_UP, 4);
      const money = new Money("10.12345", policy);
      expect(money.toString()).toBe("10.1235");
    });

    it("should propagate policy on operations", () => {
      const policy = new FiscalRoundingPolicy(FiscalRoundingStrategy.DOWN, 2);
      const m1 = new Money("10.111", policy);
      const m2 = new Money("20.222", policy);
      
      const result = m1.add(m2); // 30.333 -> down 30.33
      expect(result.currentPolicy.strategy).toBe(FiscalRoundingStrategy.DOWN);
      expect(result.toString()).toBe("30.33");
    });
  });

  describe("Equality", () => {
    it("should be equal if rounded values are the same", () => {
      const m1 = new Money("10.554");
      const m2 = new Money("10.551");
      
      // Default precision is 2, rounding HALF_UP -> both become 10.55
      expect(m1.equals(m2)).toBe(true);
    });

    it("should not be equal if rounded values differ", () => {
      const m1 = new Money("10.556"); // rounds to 10.56
      const m2 = new Money("10.554"); // rounds to 10.55
      expect(m1.equals(m2)).toBe(false);
    });
  });
});
