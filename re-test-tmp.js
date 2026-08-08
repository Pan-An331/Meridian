const s = '早上 8 点备份电脑数据，60 分钟';
const re = /[上下中]午\s*\d{1,2}点|晚上\s*\d{1,2}点|早上\s*\d{1,2}点|凌晨\s*\d{1,2}点|今晚|今[早晚]/;
console.log('source:', re.source);
console.log('test:', re.test(s));
console.log('charCodes:', [...'早上 8'].map(c => c.codePointAt(0).toString(16)));
