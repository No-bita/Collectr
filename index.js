import "dotenv/config";
import { config } from "./src/config/env.js";
import { createApp } from "./src/app.js";

const app = createApp();

app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});
