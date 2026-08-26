describe("Vizcom Tech Pack editor spike", () => {
  it("creates and manages typed document sections", () => {
    cy.visit("/tech-pack-spike");

    cy.contains("Performance Runner 001").should("be.visible");
    cy.contains("Upper specification").should("be.visible");
    cy.contains("Graphic & sole details").should("be.visible");
    cy.contains("button", "Annotate").should("have.attr", "aria-pressed", "true");
    cy.contains("All Regions").should("not.exist");
    cy.get("svg[aria-label='Interactive Region Map']").should("not.exist");

    cy.contains("button", "Add section").click();
    cy.contains("Add a document section").should("be.visible");
    cy.contains("button", "Region Map").should("be.visible");
    cy.contains("button", "Component / BOM").click();
    cy.contains("Component / BOM section added · saved").should("be.visible");

    cy.get('[aria-label="Rename Component / BOM"]').click();
    cy.get('input[aria-label="Section name"]').clear().type("Factory BOM");
    cy.get('[aria-label="Save section name"]').click();
    cy.contains("Section renamed · saved").should("be.visible");

    cy.get('[aria-label="Duplicate Factory BOM"]').click();
    cy.contains("Factory BOM copy").should("exist");
    cy.contains("Factory BOM duplicated · saved").should("be.visible");

    cy.contains("article", "Factory BOM copy").scrollIntoView().trigger("dragstart");
    cy.contains("article", "Upper specification").trigger("dragover").trigger("drop");
    cy.contains("Sections reordered · saved").should("be.visible");

    cy.get('[aria-label="Delete Factory BOM copy"]').click();
    cy.contains("Section deleted · saved").should("be.visible");
    cy.contains("Factory BOM copy").should("not.exist");

    cy.contains("button", "Add callout").click();
    cy.contains("Edited locally · source links preserved").should("be.visible");

    cy.window().then((win) => {
      const pages = JSON.parse(win.localStorage.getItem("vizcom-tech-pack-spike-pages") ?? "[]");
      expect(pages.map((page: { title: string }) => page.title)).to.deep.equal([
        "Upper specification",
        "Graphic & sole details",
        "Factory BOM",
      ]);
    });

    cy.contains("button", "Static preview").click();
    cy.contains("button", "Static preview").should("have.attr", "aria-pressed", "true");
    cy.contains("button", "Add callout").should("be.disabled");

    cy.wait(300);

    cy.screenshot("tech-pack-interactive", { capture: "viewport" });
  });

  it("renders the same ordered section document in print mode", () => {
    cy.visit("/tech-pack-spike");
    cy.contains("button", "Add section").click();
    cy.contains("button", "Construction notes").click();
    cy.get('[aria-label="Rename Construction notes"]').click();
    cy.get('input[aria-label="Section name"]').clear().type("Factory review notes");
    cy.get('[aria-label="Save section name"]').click();

    cy.visit("/tech-pack-spike/print");

    cy.get(".print-page").should("have.length", 3);
    cy.contains("Performance Runner 001").should("exist");
    cy.contains("UPPER SPECIFICATION").should("exist");
    cy.contains("SUPPLIER / REFERENCE").should("exist");
    cy.contains("ITEM CODE").should("not.exist");
    cy.contains("GRAPHIC DETAILS").should("exist");
    cy.contains("ASSEMBLY + REVIEW").should("exist");
    cy.contains("PAGE 3 / 3").should("exist");

    cy.screenshot("tech-pack-print", { capture: "fullPage" });
  });
});
