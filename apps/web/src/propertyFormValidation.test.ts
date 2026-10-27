import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validatePropertyForm } from "./propertyFormValidation";

const valid = {
  propertyType: "agricultural",
  reviewPurpose: "legal_due_diligence",
  primaryDocumentType: "sale_deed",
  districtId: "d",
  talukId: "t",
  hobliId: "h",
  villageId: "v",
  surveyNumber: "42",
  subdivision: "2A",
  address: "Near Main Road",
  boundaryNorth: "Public road",
  boundarySouth: "Canal",
  boundaryEast: "Site 4",
  boundaryWest: "Land of Rao",
};

describe("property form validation", () => {
  it("rejects whitespace-only required values", () =>
    assert.ok(
      validatePropertyForm({ ...valid, surveyNumber: "   " }).surveyNumber,
    ));
  it("accepts a valid agricultural case", () =>
    assert.deepEqual(validatePropertyForm(valid), {}));
  it("requires both non-agricultural identifier fields", () => {
    const errors = validatePropertyForm({
      ...valid,
      propertyType: "non_agricultural",
      propertyIdentifierType: "",
      propertyIdentifier: " ",
    });
    assert.ok(errors.propertyIdentifierType);
    assert.ok(errors.propertyIdentifier);
  });
});
