import { scriptCreateSchema, scriptUpdateSchema } from "@/lib/validation";

describe("script schema validation", () => {
  it("accepts create payload", () => {
    const parsed = scriptCreateSchema.parse({
      title: "Discovery opener",
      content: "Hi {{name}}, quick question...",
      tags: ["discovery"],
      isActive: true,
    });
    expect(parsed.title).toBe("Discovery opener");
  });

  it("rejects empty title", () => {
    expect(() =>
      scriptCreateSchema.parse({
        title: "",
        content: "Hello",
      }),
    ).toThrow();
  });

  it("accepts partial update", () => {
    const parsed = scriptUpdateSchema.parse({
      content: "Updated text",
    });
    expect(parsed.content).toBe("Updated text");
  });
});
