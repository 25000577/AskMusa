/* =========================================================
   MatricLab — data layer
   Everything content-related lives here so the rest of the
   app can stay generic. Swap or extend this file to add
   subjects, papers, or hub content without touching the UI code.
   ========================================================= */

const SUBJECTS = [
  { id: "mathematics", name: "Mathematics", icon: "Σ", color: "amber",
    blurb: "Algebra, functions, calculus, trig & stats" },
  { id: "physical-sciences", name: "Physical Sciences", icon: "⚛", color: "teal",
    blurb: "Mechanics, electricity, waves & chemistry" },
  { id: "life-sciences", name: "Life Sciences", icon: "✤", color: "coral",
    blurb: "Cells, genetics, physiology & ecology" },
  { id: "information-technology", name: "Information Technology", icon: "{ }", color: "violet",
    blurb: "Programming, databases, networks & systems" }
];

/* ---------------------------------------------------------
   Quiz banks — grouped by subject, then by "paper" the way
   NSC exams are actually structured.
   --------------------------------------------------------- */
const QUIZ_BANK = {
  mathematics: [
    {
      title: "Paper 1 · Algebra, Functions & Calculus",
      questions: [
        { q: "Solve for x: 2x² − 8 = 0",
          options: ["x = ±2", "x = ±4", "x = 2 only", "x = ±√8"],
          correct: 0,
          explain: "2x² = 8, so x² = 4, giving x = ±2." },
        { q: "If f(x) = 3x² − 5x + 2, what is f'(x)?",
          options: ["6x − 5", "3x − 5", "6x + 2", "6x² − 5"],
          correct: 0,
          explain: "Differentiate term by term: d/dx(3x²) = 6x, d/dx(−5x) = −5, d/dx(2) = 0." },
        { q: "An arithmetic sequence has T₁ = 4 and common difference d = 3. What is T₁₀?",
          options: ["27", "30", "31", "34"],
          correct: 2,
          explain: "Tₙ = a + (n − 1)d = 4 + (9 × 3) = 31." },
        { q: "Factorise x² − 9.",
          options: ["(x − 3)(x + 3)", "(x − 9)(x + 1)", "(x + 3)²", "It cannot be factorised"],
          correct: 0,
          explain: "This is a difference of two squares: x² − 9 = (x − 3)(x + 3)." },
        { q: "Solve for x: log₂(x) = 5",
          options: ["10", "25", "32", "64"],
          correct: 2,
          explain: "log₂(x) = 5 means x = 2⁵ = 32." }
      ]
    },
    {
      title: "Paper 2 · Trigonometry, Geometry & Statistics",
      questions: [
        { q: "If sinθ = 0.6 and θ is acute, what is cosθ? (sin²θ + cos²θ = 1)",
          options: ["0.4", "0.6", "0.8", "1.2"],
          correct: 2,
          explain: "cos²θ = 1 − 0.36 = 0.64, so cosθ = √0.64 = 0.8." },
        { q: "What is the sum of the interior angles of a hexagon?",
          options: ["540°", "600°", "720°", "900°"],
          correct: 2,
          explain: "Sum = (n − 2) × 180° = (6 − 2) × 180° = 720°." },
        { q: "What is the mean of the data set 5, 7, 9, 11, 13?",
          options: ["7", "9", "11", "13"],
          correct: 1,
          explain: "(5 + 7 + 9 + 11 + 13) ÷ 5 = 45 ÷ 5 = 9." },
        { q: "sin(90° − θ) is equal to:",
          options: ["sinθ", "cosθ", "tanθ", "1"],
          correct: 1,
          explain: "This is the co-function identity: sin(90° − θ) = cosθ." },
        { q: "Standard deviation describes:",
          options: ["The middle value of a data set", "How spread out data is around the mean", "The most frequent value", "The total of all values"],
          correct: 1,
          explain: "Standard deviation measures the average distance of data points from the mean." }
      ]
    }
  ],

  "physical-sciences": [
    {
      title: "Paper 1 · Mechanics & Electricity",
      questions: [
        { q: "What force is needed to accelerate a 5 kg object at 2 m/s²? (F = ma)",
          options: ["2.5 N", "7 N", "10 N", "25 N"],
          correct: 2,
          explain: "F = m × a = 5 × 2 = 10 N." },
        { q: "What is the SI unit of electric current?",
          options: ["Volt", "Ampere", "Ohm", "Watt"],
          correct: 1,
          explain: "Electric current is measured in amperes (A)." },
        { q: "Using Ohm's law V = IR, if I = 2 A and R = 5 Ω, what is V?",
          options: ["2.5 V", "3 V", "7 V", "10 V"],
          correct: 3,
          explain: "V = I × R = 2 × 5 = 10 V." },
        { q: "An object in free fall near Earth's surface accelerates at approximately:",
          options: ["5 m/s²", "8 m/s²", "9.8 m/s²", "12 m/s²"],
          correct: 2,
          explain: "Gravitational acceleration near Earth's surface is about 9.8 m/s²." },
        { q: "Which law states that every action has an equal and opposite reaction?",
          options: ["Newton's First Law", "Newton's Second Law", "Newton's Third Law", "Law of conservation of energy"],
          correct: 2,
          explain: "Newton's Third Law describes equal and opposite action-reaction force pairs." }
      ]
    },
    {
      title: "Paper 2 · Chemical Systems & Reactions",
      questions: [
        { q: "Which equation correctly balances the combustion of methane?",
          options: ["CH₄ + O₂ → CO₂ + H₂O", "CH₄ + 2O₂ → CO₂ + 2H₂O", "2CH₄ + O₂ → 2CO₂ + H₂O", "CH₄ + 2O₂ → 2CO₂ + H₂O"],
          correct: 1,
          explain: "Balancing atoms on both sides gives CH₄ + 2O₂ → CO₂ + 2H₂O." },
        { q: "What is the pH of a neutral solution at 25°C?",
          options: ["0", "7", "14", "1"],
          correct: 1,
          explain: "A neutral solution has a pH of 7 at 25°C." },
        { q: "Which subatomic particle carries a negative charge?",
          options: ["Proton", "Neutron", "Electron", "Nucleus"],
          correct: 2,
          explain: "Electrons carry a negative charge and orbit the nucleus." },
        { q: "The molar mass of water (H₂O) is approximately:",
          options: ["16 g/mol", "18 g/mol", "20 g/mol", "22 g/mol"],
          correct: 1,
          explain: "(2 × 1) + 16 = 18 g/mol." },
        { q: "In a chemical reaction, a catalyst:",
          options: ["Increases the reaction rate without being consumed", "Decreases the amount of product formed", "Is always consumed in the reaction", "Only works at very high temperatures"],
          correct: 0,
          explain: "Catalysts speed up reactions by lowering activation energy, and are not used up." }
      ]
    }
  ],

  "life-sciences": [
    {
      title: "Paper 1 · Life Processes",
      questions: [
        { q: "Which organelle is known as the \"powerhouse of the cell\"?",
          options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi body"],
          correct: 1,
          explain: "Mitochondria produce most of the cell's ATP through respiration." },
        { q: "What does DNA stand for?",
          options: ["Deoxyribonucleic acid", "Dynamic nucleic acid", "Diribose nucleic acid", "Deoxyribose nuclear acid"],
          correct: 0,
          explain: "DNA stands for deoxyribonucleic acid." },
        { q: "Photosynthesis converts light energy into:",
          options: ["Heat energy", "Chemical energy stored in glucose", "Kinetic energy", "Electrical energy"],
          correct: 1,
          explain: "Plants store captured light energy as chemical energy in glucose." },
        { q: "How many chambers does the human heart have?",
          options: ["2", "3", "4", "5"],
          correct: 2,
          explain: "The human heart has four chambers: two atria and two ventricles." },
        { q: "How many daughter cells does meiosis produce from one parent cell?",
          options: ["1", "2", "4", "8"],
          correct: 2,
          explain: "Meiosis involves two divisions, producing four haploid daughter cells." }
      ]
    }
  ],

  "information-technology": [
    {
      title: "Paper 1 · Systems, Networks & Programming",
      questions: [
        { q: "Which SQL command retrieves every row from a table named Learners?",
          options: ["GET * FROM Learners", "SELECT * FROM Learners", "FETCH ALL Learners", "SHOW Learners"],
          correct: 1,
          explain: "SELECT * FROM Learners returns every column for every row in the table." },
        { q: "What is the binary representation of the decimal number 10?",
          options: ["1010", "1100", "1001", "1110"],
          correct: 0,
          explain: "10 in decimal is 1010 in binary (8 + 2)." },
        { q: "CPU stands for:",
          options: ["Computer Processing Unit", "Central Processing Unit", "Central Program Utility", "Computer Program Unit"],
          correct: 1,
          explain: "CPU stands for Central Processing Unit, the computer's main processor." },
        { q: "A loop that repeats a known, fixed number of times is best written as a:",
          options: ["while loop", "do-while loop", "for loop", "if statement"],
          correct: 2,
          explain: "A for loop is designed for a counted, predictable number of repetitions." },
        { q: "The field that uniquely identifies each record in a database table is the:",
          options: ["Foreign key", "Primary key", "Index", "Field name"],
          correct: 1,
          explain: "A primary key uniquely identifies each record in a table." }
      ]
    }
  ]
};

/* ---------------------------------------------------------
   Varsity Hub reference content.
   Dates are an illustrative example timeline, not official —
   the UI reminds the learner to confirm with real institutions.
   --------------------------------------------------------- */
const KEY_DATES = [
  { when: "Apr – Jun", what: "Most universities open applications for the following academic year." },
  { when: "Jul", what: "National Benchmark Test (NBT) registration windows open for many programmes." },
  { when: "Sep – Oct", what: "Early closing dates hit — Health Sciences, Engineering and Law fill up first." },
  { when: "Oct – Nov", what: "NSC final exams: Paper 1, 2 (and 3, where applicable) per subject." },
  { when: "Dec – Jan", what: "NSC results are released; conditional offers can become firm offers." },
  { when: "Jan", what: "NSFAS and university financial-aid confirmation deadlines." }
];

const CHECKLIST_ITEMS = [
  "Certified copy of ID document",
  "Certified Grade 11 final results + Grade 12 mid-year report",
  "Proof of residence",
  "Online application submitted per university",
  "Application fee paid (or fee waiver requested)",
  "Motivational letter / personal statement (if required)",
  "NBT booked, if the faculty requires it",
  "NSFAS application submitted (if applying for funding)",
  "Proof of income / affidavit for financial aid",
  "Subject choices checked against faculty requirements",
  "Reference letters requested (if needed)",
  "ID photo uploaded to the application portal"
];

/* Target date for the hero countdown — update to your real NSC writing date. */
const EXAM_TARGET_DATE = new Date("2026-10-26T08:00:00");
