import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const categoriesPath = path.join(root, "data/categories.json");

const errors = [];
const warnings = [];
let categories = {};
let indexEntries = [];
let indexedProducts = 0;
let checkedDetails = 0;

try {
  categories = JSON.parse(fs.readFileSync(categoriesPath, "utf8"));
  indexEntries = Object.values(categories || {}).flatMap((category) =>
    Object.values(category?.productTypes || {}).flatMap((productType) =>
      Object.entries(productType?.grades || {}),
    ),
  );
  if (!indexEntries.length) errors.push("ไม่พบเส้นทาง index ใน categories.json");
} catch (error) {
  errors.push(`เปิด categories.json ไม่สำเร็จ: ${error.message}`);
}

const ids = new Set();

for (const [grade, relativeIndexPath] of indexEntries) {
  let index = [];
  try {
    index = JSON.parse(fs.readFileSync(path.join(root, relativeIndexPath), "utf8"));
    if (!Array.isArray(index)) {
      errors.push(`${grade} index.json ต้องเป็น Array`);
      continue;
    }
  } catch (error) {
    errors.push(`เปิด ${grade} index.json ไม่สำเร็จ: ${error.message}`);
    continue;
  }
  indexedProducts += index.length;

  for (const summary of index) {
    if (ids.has(summary.id)) errors.push(`รหัสสินค้าซ้ำ: ${summary.id}`);
    ids.add(summary.id);
    if (summary.grade !== grade) {
      errors.push(`เกรดไม่ตรงกัน: index=${grade}, item=${summary.id}:${summary.grade}`);
    }

    const detailPath = path.join(root, summary.dataFile || "");
    if (!summary.dataFile || !fs.existsSync(detailPath)) {
      errors.push(`ไม่พบ JSON รายสินค้า: ${summary.dataFile || summary.id}`);
      continue;
    }

    let detail;
    try {
      detail = JSON.parse(fs.readFileSync(detailPath, "utf8"));
      checkedDetails += 1;
    } catch (error) {
      errors.push(`JSON เสีย ${summary.dataFile}: ${error.message}`);
      continue;
    }

    if (detail.id !== summary.id) {
      errors.push(`รหัสไม่ตรงกัน: index=${summary.id}, detail=${detail.id}`);
    }
    if (detail.grade !== grade) {
      errors.push(`เกรด detail ไม่ตรงกัน: index=${grade}, detail=${detail.id}:${detail.grade}`);
    }

    const imageFiles = [
      ...(Array.isArray(detail.images) ? detail.images : []),
      ...(Array.isArray(detail.manualImages) ? detail.manualImages : []),
      ...(detail.catalogImage ? [detail.catalogImage] : []),
    ];

    for (const imageFile of new Set(imageFiles)) {
      if (!fs.existsSync(path.join(root, imageFile))) {
        warnings.push(`ไม่พบรูป ${detail.id}: ${imageFile}`);
      }
    }
  }
}

console.log(`แคตตาล็อกที่ตรวจ: ${indexEntries.length} เกรด`);
console.log(`สินค้าใน index รวม: ${indexedProducts} รายการ`);
console.log(`JSON รายสินค้าที่ตรวจ: ${checkedDetails} ไฟล์`);
console.log(`ข้อผิดพลาด: ${errors.length}`);
console.log(`คำเตือนเรื่องรูป: ${warnings.length}`);

for (const error of errors) console.error(`ERROR: ${error}`);
for (const warning of warnings) console.warn(`WARNING: ${warning}`);

if (errors.length) process.exit(1);
console.log("PASS: โครงสร้าง JSON พร้อมใช้งาน");
