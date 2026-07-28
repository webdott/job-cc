import dotenv from "dotenv";

dotenv.config({ path: ".env.test", quiet: true });

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

afterEach(cleanup);
