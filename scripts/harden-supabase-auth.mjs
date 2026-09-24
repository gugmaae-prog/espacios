const token = process.env.SUPABASE_ACCESS_TOKEN || "";
const projectRef = "ypkfganbwdvcjrcxygta";
const target = {
  password_hibp_enabled: true,
  db_max_pool_size: 17,
  db_max_pool_size_unit: "percent",
};

if (!token) {
  console.log("SUPABASE_ACCESS_TOKEN available: false");
  process.exit(0);
}

async function api(method, path, body) {
  const response = await fetch("https://api.supabase.com" + path, {
    method,
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 500) }; }
  if (!response.ok) {
    throw new Error(method + " " + path + " -> " + response.status + " " + JSON.stringify(data));
  }
  return data;
}

const before = await api("GET", "/v1/projects/" + projectRef + "/config/auth");
console.log("SUPABASE_ACCESS_TOKEN available: true");
console.log("Before:", JSON.stringify({
  password_hibp_enabled: before.password_hibp_enabled,
  db_max_pool_size: before.db_max_pool_size,
  db_max_pool_size_unit: before.db_max_pool_size_unit,
}));

const needsPatch =
  before.password_hibp_enabled !== target.password_hibp_enabled ||
  before.db_max_pool_size !== target.db_max_pool_size ||
  before.db_max_pool_size_unit !== target.db_max_pool_size_unit;

if (needsPatch) {
  await api("PATCH", "/v1/projects/" + projectRef + "/config/auth", target);
}

const after = await api("GET", "/v1/projects/" + projectRef + "/config/auth");
console.log("After:", JSON.stringify({
  password_hibp_enabled: after.password_hibp_enabled,
  db_max_pool_size: after.db_max_pool_size,
  db_max_pool_size_unit: after.db_max_pool_size_unit,
}));

if (
  after.password_hibp_enabled !== true ||
  after.db_max_pool_size !== 17 ||
  after.db_max_pool_size_unit !== "percent"
) {
  throw new Error("Supabase Auth hardening target was not applied.");
}
