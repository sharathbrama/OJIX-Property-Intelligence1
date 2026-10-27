export type PropertyFormErrors = Record<string, string>;

const present = (value: unknown) => String(value ?? "").trim();

export function validatePropertyForm(
  form: Record<string, any>,
): PropertyFormErrors {
  const errors: PropertyFormErrors = {};
  const required = (key: string, message: string) => {
    if (!present(form[key])) errors[key] = message;
  };

  required("reviewPurpose", "Select the purpose of the property review.");
  required("primaryDocumentType", "Select the primary document type.");
  if (form.reviewPurpose === "other")
    required("reviewPurposeCustom", "Describe the review purpose.");
  if (form.primaryDocumentType === "other")
    required("primaryDocumentTypeCustom", "Name the primary document type.");
  for (const [key, label] of [
    ["districtId", "District"],
    ["talukId", "Taluk"],
    ["hobliId", "Hobli / Town"],
    ["villageId", "Index-II Village"],
  ] as const) {
    if (!present(form[key])) errors[key] = `Select ${label}.`;
  }

  if (form.propertyType === "agricultural") {
    required("surveyNumber", "Enter the Survey number.");
  } else {
    required("propertyIdentifierType", "Select the property number type.");
    required("propertyIdentifier", "Enter the property number.");
    if (present(form.propertyIdentifier).length > 160)
      errors.propertyIdentifier =
        "Property number must be 160 characters or fewer.";
  }

  if (present(form.surveyNumber).length > 80)
    errors.surveyNumber = "Survey number must be 80 characters or fewer.";
  if (present(form.subdivision).length > 80)
    errors.subdivision = "Hissa must be 80 characters or fewer.";
  const address = present(form.address);
  if (!address)
    errors.address = "Enter the property address or clear directions.";
  else if (address.length < 10 || address.split(/\s+/).length < 2)
    errors.address =
      "Use at least two words, such as a road, landmark, or locality.";
  for (const [key, label] of [
    ["boundaryNorth", "North"],
    ["boundarySouth", "South"],
    ["boundaryEast", "East"],
    ["boundaryWest", "West"],
  ] as const) {
    const value = present(form[key]);
    if (!value) errors[key] = `Enter the ${label.toLowerCase()} boundary.`;
    else if (value.length < 4 || /^([a-z])\1+$/i.test(value))
      errors[key] = `Describe a specific ${label.toLowerCase()} boundary.`;
  }

  for (const key of [
    "agriAcres",
    "agriGuntas",
    "agriCents",
    "propertyMeasure",
    "eastWestMeasure",
    "northSouthMeasure",
  ]) {
    const value = present(form[key]);
    if (value && (!Number.isFinite(Number(value)) || Number(value) < 0))
      errors[key] = "Enter zero or a positive number.";
  }
  return errors;
}
