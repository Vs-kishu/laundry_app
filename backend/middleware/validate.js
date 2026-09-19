// Validates req.body against a zod schema and replaces it with the parsed (trimmed, coerced) data.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    const first = issues[0];
    return res.status(400).json({
      message: first.field ? `${first.field}: ${first.message}` : first.message,
      errors: issues,
    });
  }
  req.body = result.data;
  next();
};

module.exports = validate;
