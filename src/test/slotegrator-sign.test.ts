import { describe, expect, it } from "vitest";
import { buildSignString } from "@/lib/slotegrator-shared";

describe("Slotegrator signing", () => {
  it("sorts keys and form-encodes values", () => {
    expect(
      buildSignString({ "X-Nonce": "n1", page: "2", "X-Merchant-Id": "m", "X-Timestamp": "10" }),
    ).toBe("X-Merchant-Id=m&X-Nonce=n1&X-Timestamp=10&page=2");
  });

  it("encodes spaces and URLs like PHP http_build_query", () => {
    expect(buildSignString({ return_url: "https://a.com/x?y=1", name: "a b" })).toBe(
      "name=a+b&return_url=https%3A%2F%2Fa.com%2Fx%3Fy%3D1",
    );
  });
});
