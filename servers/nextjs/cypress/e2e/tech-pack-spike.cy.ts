describe("Vizcom Tech Pack editor spike", () => {
  it("uses a canvas-first Region Map flow and updates the bound document", () => {
    cy.visit("/tech-pack-spike");

    cy.contains("Performance Runner 001").should("be.visible");
    cy.contains("All Regions").should("be.visible");
    cy.get("svg[aria-label='Interactive Region Map']").should("be.visible");

    cy.get("[data-region-id='part-cage']").click();
    cy.get("[data-region-id='part-cage']").should("have.attr", "stroke", "#FFFFFF");
    cy.get("[data-region-id='part-midsole']").click({ shiftKey: true });
    cy.contains("2 regions selected").should("be.visible");

    cy.get("input[aria-label='Edit Quarter cage color']").then(($input) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call($input[0], "#8f6ad9");
      $input[0].dispatchEvent(new Event("input", { bubbles: true }));
    });
    cy.get("[data-region-id='part-cage']").should("have.attr", "fill", "#8F6AD9");

    cy.get("button[aria-label='Open Quarter cage details']").click();
    cy.contains("button", "Engineered knit").click();
    cy.get("input[aria-label='Region part name']:visible").clear().type("Quarter support cage");
    cy.contains("Region Map updated · bound callouts refreshed").should("be.visible");
    cy.get("button[aria-label='Back to all regions']").click();

    cy.contains("button", "Update document").click();
    cy.contains("Upper specification").should("be.visible");
    cy.contains("Graphic & sole details").should("be.visible");
    cy.contains("button", "Annotate").should("have.attr", "aria-pressed", "true");
    cy.contains("1 view verified · 4 Region Map parts linked").should("be.visible");

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

    cy.contains("button", "Region Map").click();
    cy.contains("All Regions").should("be.visible");

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
