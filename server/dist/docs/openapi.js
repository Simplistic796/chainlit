"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadOpenApiV1 = loadOpenApiV1;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const yaml_1 = __importDefault(require("yaml"));
let cached = null;
function loadOpenApiV1() {
    if (cached)
        return cached;
    const p = path_1.default.join(process.cwd(), "openapi", "chainlit.v1.yaml");
    const raw = fs_1.default.readFileSync(p, "utf8");
    cached = yaml_1.default.parse(raw);
    return cached;
}
//# sourceMappingURL=openapi.js.map