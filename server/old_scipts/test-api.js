const express = require('express');
const pg = require('pg');
require('dotenv').config({ path: '../server/.env' });
const studentsRouter = require('../server/routes/students');
