/**
 * Replace all data with the real Marketing team roster.
 *   npm run load-marketing-team
 *
 * Wipes every table (like `seed.js --reset`) then creates the 19 real
 * people from "Marketing Team.xlsx". Every account gets the same temporary
 * password below and must change it on first sign-in.
 */
import { db, upsertEmployee, setPassword, setConfig, listEmployees } from "../src/db.js";
import { hashPassword } from "../src/auth.js";

const PASSWORD = process.env.SEED_PASSWORD || "controlcenter1";

const CONFIG_OVERRIDE = {
  departments: [
    { id: "mkt", name: "Marketing", teams: [
      { id: "seo", name: "SEO" },
      { id: "content", name: "Content" },
      { id: "webdev", name: "Web Development" },
      { id: "design", name: "Design" },
      { id: "email", name: "Email Marketing" }
    ] },
    { id: "ops", name: "Operations", teams: [{ id: "admin", name: "Admin" }, { id: "hr", name: "HR" }, { id: "it", name: "IT" }] }
  ]
};

// name, email, title, role, teamId
const PEOPLE = [
  ["Roshani Shinde",                  "rshinde@lghomecomfort.ca",    "Marketing Manager",                        "manager",  ""],
  ["Mayuresh Sorap",                  "msorap@lghomecomfort.ca",     "Team Lead - Digital Marketing",            "manager",  ""],
  ["Wilson Fernandes",                "WFernandes@lghomecomfort.ca", "Senior SEO Executive",                     "employee", "seo"],
  ["Moinul Khan",                     "MoKhan@lghomecomfort.ca",     "Senior Content Writer",                    "employee", "content"],
  ["Param Lakhani",                   "PLakhani@lghomecomfort.ca",   "SEO Content Writer",                       "employee", "content"],
  ["Samruddhi Prashant Machirale",    "smachivale@lghomecomfort.ca", "SEO Executive",                            "employee", "seo"],
  ["Nishant Bharmal",                 "NBharmal@lghomecomfort.ca",   "Web developer",                            "employee", "webdev"],
  ["Shubham Vilas Girkar",            "SGirkar@lghomecomfort.ca",    "Web developer",                            "employee", "webdev"],
  ["Devendra Rajendra Patil",         "DPatil@lghomecomfort.ca",     "Web developer",                            "employee", "webdev"],
  ["Anup Santosh Kankale",            "akankale@lghomecomfort.ca",   "Web developer",                            "employee", "webdev"],
  ["Bhavin Patel",                    "bpatel@lghomecomfort.ca",     "Web developer",                            "employee", "webdev"],
  ["Danish Abdul Hamid Shaikh",       "dshaikh@lghomecomfort.ca",    "Web developer",                            "employee", "webdev"],
  ["Namrata Pandurang",               "nburondkar@lghomecomfort.ca", "UI/UX Designer",                           "employee", "design"],
  ["Priyanka Kochrekar",              "PKochrekar@lghomecomfort.ca", "UI/UX Designer",                           "employee", "design"],
  ["Shreyash Sanjay Patil",           "ShPatil@lghomecomfort.ca",    "Graphic Designer",                         "employee", "design"],
  ["Avinash Tippanna Padsalgi",       "apadsalgi@lghomecomfort.ca",  "Graphic Designer",                         "employee", "design"],
  ["Parmeshwar Sherve",               "PSherve@lghomecomfort.ca",    "Email marketing Executive",                "employee", "email"],
  ["Rina Nadar",                      "RNadar@lghomecomfort.ca",     "Salesforce Marketing Cloud Executive",     "employee", "email"],
  ["Sarvesh Bhosale",                 "SBhosale@lghomecomfort.ca",   "Email marketing & automation specialist",  "employee", "email"]
];

console.log("Wiping every table…");
db.exec(`DELETE FROM task_activity; DELETE FROM task_comments; DELETE FROM tasks;
         DELETE FROM daily_updates; DELETE FROM projects; DELETE FROM sessions;
         DELETE FROM employees; DELETE FROM config;`);

const load = db.transaction(() => {
  setConfig(CONFIG_OVERRIDE);
  for (const [name, email, title, role, teamId] of PEOPLE) {
    const id = "emp-" + email.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
    upsertEmployee({ id, name, email, initials, role, title, departmentId: "mkt", teamId, capacityHours: 40, active: true });
    setPassword(id, hashPassword(PASSWORD), 1);
  }
});
load();

console.log(`
  Loaded ${listEmployees().length} people from the Marketing Team roster.

  Everyone's starting password is:  ${PASSWORD}
  They are prompted to change it after signing in.

  Managers:   Roshani Shinde (rshinde@lghomecomfort.ca)
              Mayuresh Sorap (msorap@lghomecomfort.ca)
`);
