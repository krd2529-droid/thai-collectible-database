import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const indexPath = path.join(
  root,
  "data/catalog/gundam/gunpla/rg/index.json",
);

const errors = [];
const warnings = [];
let index = [];

try {
  index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  if (!Array.isArray(index)) errors.push("RG index.json ต้องเป็น Array");
} catch (error) {
  errors.push(`เปิด RG index.json ไม่สำเร็จ: ${error.message}`);
}

const ids = new Set();

for (const summary of index) {
  if (ids.has(summary.id)) errors.push(`รหัสสินค้าซ้ำ: ${summary.id}`);
  ids.add(summary.id);

  const detailPath = path.join(root, summary.dataFile || "");
  if (!fs.existsSync(detailPath)) {
    errors.push(`ไม่พบ JSON รายสินค้า: ${summary.dataFile}`);
    continue;
  }

  let detail;
  try {
    detail = JSON.parse(fs.readFileSync(detailPath, "utf8"));
  } catch (error) {
    errors.push(`JSON เสีย ${summary.dataFile}: ${error.message}`);
    continue;
  }

  if (detail.id !== summary.id) {
    errors.push(`รหัสไม่ตรงกัน: index=${summary.id}, detail=${detail.id}`);
  }

  const imageFiles = [
    ...(detail.images || []),
    ...(detail.manualImages || []),
  ];

  for (const imageFile of imageFiles) {
    if (!fs.existsSync(path.join(root, imageFile))) {
      warnings.push(`ไม่พบรูป ${detail.id}: ${imageFile}`);
    }
  }
}

console.log(`สินค้าใน RG index: ${index.length} รายการ`);
console.log(`JSON รายสินค้าที่ตรวจ: ${ids.size} ไฟล์`);
console.log(`ข้อผิดพลาด: ${errors.length}`);
console.log(`คำเตือนเรื่องรูป: ${warnings.length}`);

for (const error of errors) console.error(`ERROR: ${error}`);
for (const warning of warnings) console.warn(`WARNING: ${warning}`);

if (errors.length) process.exit(1);
console.log("PASS: โครงสร้าง JSON พร้อมใช้งาน");
