describe("Vizcom Tech Pack editor spike", () => {
  it("opens directly in the slide editor without duplicating Vizcom Regions", () => {
    cy.visit("/tech-pack-spike");

    cy.contains("Performance Runner 001").should("be.visible");
    cy.contains("Upper specification").should("be.visible");
    cy.contains("Graphic & sole details").should("be.visible");
    cy.contains("button", "Annotate").should("have.attr", "aria-pressed", "true");
    cy.contains("All Regions").should("not.exist");
    cy.get("svg[aria-label='Interactive Region Map']").should("not.exist");

    cy.contains("button", "Add section").click();
    cy.contains("Custom section 3").should("be.visible");
    cy.contains("New custom section · unsaved").should("be.visible");

    cy.contains("button", "Add callout").click();
    cy.contains("Edited locally · source links preserved").should("be.visible");

    cy.get("select[aria-label='Create from template']").select("upper-one-page");
    cy.contains("Created from Vizcom template · source links preserved").should("be.visible");
    cy.contains("Upper specification").should("be.visible");

    cy.contains("button", "Static preview").click();
    cy.contains("button", "Static preview").should("have.attr", "aria-pressed", "true");
    cy.contains("button", "Add callout").should("be.disabled");

    cy.wait(300);

    cy.screenshot("tech-pack-interactive", { capture: "viewport" });
  });

  it("renders a printable document from the same structured pages", () => {
    cy.visit("/tech-pack-spike/print");

    cy.get(".print-page").should("have.length", 2);
    cy.contains("Performance Runner 001").should("exist");
    cy.contains("UPPER SPECIFICATION").should("exist");
    cy.contains("GRAPHIC DETAILS").should("exist");

    cy.screenshot("tech-pack-print", { capture: "fullPage" });
  });
});
