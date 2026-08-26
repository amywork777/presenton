export type TechPackSourceRef = {
  assetId: string;
  workbenchId: string;
  imageUrl: string;
};

export type TechPackView = {
  id: string;
  label: "Primary" | "Top" | "Heel";
  imageUrl: string | null;
  sourceAssetId: string;
  workflowId: string | null;
  verified: boolean;
};

export type TechPackPart = {
  id: string;
  regionLayerId: string;
  name: string;
  material: string;
  colorName: string;
  colorHex: string;
  supplier: string;
  vendorItemIdentifier: string;
  vendorMaterialName: string;
  finish: string;
  materialPartNumber: string;
  /** Normalized Region Map alpha-mask anchor, populated by the #6709 pipeline. */
  anchor: { x: number; y: number };
  notes: string;
};

export type TechPackHeader = {
  introDate: string;
  currentDate: string;
  itemCode: string;
  businessUnit: string;
  protoRound: string;
  sequenceId: string;
  developmentFactory: string;
  designer: string;
  developer: string;
  projectType: "TN" | "NU" | "MU" | "CU";
  referenceNumber: string;
};

export type TechPackDocument = {
  id: string;
  title: string;
  styleNumber: string;
  revision: string;
  header: TechPackHeader;
  intent: string;
  primarySource: TechPackSourceRef;
  views: TechPackView[];
  parts: TechPackPart[];
  constructionNotes: string[];
};

export const techPackExample: TechPackDocument = {
  id: "tech-pack-runner-001",
  title: "Performance Runner 001",
  styleNumber: "VZ-RUN-001",
  revision: "R01",
  header: {
    introDate: "SS27",
    currentDate: "25 AUG 2026",
    itemCode: "VZ-RUN-001",
    businessUnit: "RUNNING",
    protoRound: "P1",
    sequenceId: "TP-001",
    developmentFactory: "TBD",
    designer: "VIZCOM DESIGN",
    developer: "TBD",
    projectType: "NU",
    referenceNumber: "—",
  },
  intent:
    "Factory review handoff for the monochrome performance colorway, focused on upper construction and sole assembly.",
  primarySource: {
    assetId: "asset-real-sneaker-side",
    workbenchId: "workbench-tech-pack-spike",
    imageUrl: "/tech-pack-assets/real-sneaker-side.png",
  },
  views: [
    {
      id: "view-primary",
      label: "Primary",
      imageUrl: "/tech-pack-assets/real-sneaker-side.png",
      sourceAssetId: "asset-real-sneaker-side",
      workflowId: null,
      verified: true,
    },
    {
      id: "view-top",
      label: "Top",
      imageUrl: null,
      sourceAssetId: "asset-real-sneaker-side",
      workflowId: "new-view-runner-top",
      verified: false,
    },
    {
      id: "view-heel",
      label: "Heel",
      imageUrl: null,
      sourceAssetId: "asset-real-sneaker-side",
      workflowId: "new-view-runner-heel",
      verified: false,
    },
  ],
  parts: [
    {
      id: "part-upper",
      regionLayerId: "region-upper",
      name: "Knit upper",
      material: "Engineered polyester knit",
      colorName: "Fog grey",
      colorHex: "#A8A8A2",
      supplier: "TBD",
      vendorItemIdentifier: "TBD",
      vendorMaterialName: "ENGINEERED KNIT",
      finish: "MATTE / TWO-DENSITY",
      materialPartNumber: "KNT-TBD",
      anchor: { x: 0.62, y: 0.38 },
      notes: "Two-density knit; tighter structure at toe and eyestay.",
    },
    {
      id: "part-cage",
      regionLayerId: "region-cage",
      name: "Quarter cage",
      material: "Injected TPU",
      colorName: "Graphite",
      colorHex: "#3C3C3A",
      supplier: "TBD",
      vendorItemIdentifier: "TBD",
      vendorMaterialName: "INJECTED TPU",
      finish: "MATTE",
      materialPartNumber: "TPU-TBD",
      anchor: { x: 0.46, y: 0.56 },
      notes: "Matte finish; no visible gate marks on lateral face.",
    },
    {
      id: "part-midsole",
      regionLayerId: "region-midsole",
      name: "Midsole",
      material: "Compression-molded EVA",
      colorName: "Warm white",
      colorHex: "#E8E5DC",
      supplier: "TBD",
      vendorItemIdentifier: "TBD",
      vendorMaterialName: "CM EVA FOAM",
      finish: "MOLDED",
      materialPartNumber: "EVA-TBD",
      anchor: { x: 0.54, y: 0.78 },
      notes: "Maintain sculpted geometry shown in approved lateral view.",
    },
    {
      id: "part-outsole",
      regionLayerId: "region-outsole",
      name: "Outsole",
      material: "Carbon rubber",
      colorName: "Black",
      colorHex: "#171717",
      supplier: "TBD",
      vendorItemIdentifier: "TBD",
      vendorMaterialName: "CARBON RUBBER",
      finish: "TEXTURED",
      materialPartNumber: "RBR-TBD",
      anchor: { x: 0.66, y: 0.9 },
      notes: "High-abrasion compound at heel and forefoot strike zones.",
    },
  ],
  constructionNotes: [
    "Bond upper to strobel before cage attachment.",
    "Keep collar pull loop centered within 2 mm.",
    "Confirm top and heel views against the selected lateral source before release.",
  ],
};
