const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

module.exports = app;

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "abcd", (error, user) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "abcd");
      response.send({ jwtToken });
      console.log({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// app.post("/login/", async (request, response) => {
//   const { username, password } = request.body;
//   const selectUserQuery = `
//         SELECT * FROM user WHERE username = '${username}';
//     `;
//   const dbUser = await db.get(selectUserQuery);
//   if (dbUser === undefined) {
//     response.status(400);
//     response.send("Invalid user");
//   } else {
//     const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
//     if (isPasswordMatched === true) {
//       const payload = { username: username };
//       const jwtToken = jwt.sign(payload, "abcd");
//       response.send({ jwtToken });
//     } else {
//       response.send("Invalid password");
//     }
//   }
// });

app.get("/states/", authenticateToken, async (request, response) => {
  const selectStatesQuery = `
        SELECT 
            state_id AS stateId,
            state_name AS stateName,
            population
        FROM 
            state 
        ORDER BY state_id;
    `;
  const statesArray = await db.all(selectStatesQuery);
  response.send(statesArray);
});

app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const selectStatesQuery = `
        SELECT 
            state_id AS stateId,
            state_name AS stateName,
            population
        FROM 
            state 
        WHERE 
            state_id = ${stateId};
    `;
  const statesArray = await db.get(selectStatesQuery);
  response.send(statesArray);
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const selectStatesQuery = `
        INSERT INTO 
            district(district_name,state_id,cases,cured,active,deaths)
        VALUES (
            '${districtName}',
            ${stateId},
            ${cases},
            ${cured},
            ${active},
            ${deaths}
        );
    `;
  const statesArray = await db.run(selectStatesQuery);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const selectStatesQuery = `
        SELECT 
            district_id AS districtId,
            district_name AS districtName,
            state_id AS stateId,
            cases,
            cured,
            active,
            deaths
        FROM 
            district 
        WHERE 
            district_id = ${districtId};
    `;
    const statesArray = await db.get(selectStatesQuery);
    response.send(statesArray);
  }
);

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const selectStatesQuery = `
        DELETE FROM
            district 
        WHERE 
            district_id = ${districtId};
    `;
    const statesArray = await db.run(selectStatesQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const selectStatesQuery = `
        UPDATE
            district
        SET
            district_name = '${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
        WHERE district_id = ${districtId}
        ;
    `;
    const statesArray = await db.run(selectStatesQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const selectStateQuery = `
        SELECT 
            SUM(cases) AS totalCases,
            SUM(cured) AS totalCured,
            SUM(active) AS totalActive,
            SUM(deaths) AS totalDeaths
        FROM 
            state NATURAL JOIN district
        WHERE state_id = ${stateId};
    `;
    const state = await db.get(selectStateQuery);
    response.send(state);
  }
);
