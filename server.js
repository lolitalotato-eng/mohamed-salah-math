import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: "40kb" }));
app.use(express.static(path.join(__dirname, "public")));

const digits = s => s.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/٫/g, ".").replace(/،/g, ",");
const clean = s => digits(String(s)).replace(/[×✕]/g, "*").replace(/[÷]/g, "/").replace(/[−–]/g, "-").replace(/[xX]/g, "س").replace(/\s+/g, "");

// A small safe parser: no eval and no access to JavaScript features.
function parseLinear(source) {
  const s = clean(source);
  const rawTokens = s.match(/(?:\d+(?:\.\d*)?|\.\d+)|[س]|[()+\-*/^]/g) || [];
  const tokens = [];
  for (const token of rawTokens) {
    const prev = tokens[tokens.length - 1];
    if (prev && ((/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(prev) || prev === "س" || prev === ")") && (token === "س" || token === "(" || /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)))) tokens.push("*");
    tokens.push(token);
  }
  if (rawTokens.join("") !== s) throw new Error("تعذر فهم التعبير الرياضي. استخدم الأرقام والعمليات + − × ÷ والأقواس.");
  let i = 0;
  const add = (x,y,sign=1)=>({a:x.a+sign*y.a,b:x.b+sign*y.b});
  function expr(){let v=term();while(tokens[i]==="+"||tokens[i]==="-"){const op=tokens[i++];v=add(v,term(),op==="+"?1:-1);}return v;}
  function term(){let v=unary();while(tokens[i]==="*"||tokens[i]==="/"){const op=tokens[i++],w=unary();if(op==="*"){if(v.a&&w.a)throw new Error("هذه العملية تتضمن ضرب متغيرين، وهي غير مدعومة حالياً.");v={a:v.a*w.b+w.a*v.b,b:v.b*w.b};}else{if(w.a||w.b===0)throw new Error("لا يمكن القسمة على صفر أو على تعبير يحتوي على متغير.");v={a:v.a/w.b,b:v.b/w.b};}}return v;}
  function unary(){if(tokens[i]==="+"){i++;return unary();}if(tokens[i]==="-"){i++;const v=unary();return {a:-v.a,b:-v.b};}return atom();}
  function atom(){const t=tokens[i++];if(t==="("){const v=expr();if(tokens[i++]!==")")throw new Error("تأكد من إغلاق الأقواس.");return v;}if(t==="س")return {a:1,b:0};if(t!==undefined&&/^\d/.test(t)||t===".")return {a:0,b:Number(t)};throw new Error("التعبير غير مكتمل. اكتب مسألة واضحة مثل 2س+4=14.");}
  const result=expr();if(i!==tokens.length)throw new Error("يوجد جزء غير مفهوم في المسألة.");return result;
}
function fmt(n){if(!Number.isFinite(n))return String(n);return Number(n.toFixed(6)).toString();}
function solve(text){
  const raw=digits(text).trim();
  const lower=raw.toLowerCase();
  if(/مساحة.*مثلث|مثلث.*قاعدته/.test(lower)){
    const nums=raw.match(/\d+(?:\.\d+)?/g)?.map(Number)||[];
    if(nums.length>=2){const area=nums[0]*nums[1]/2;return `قانون مساحة المثلث:\nالمساحة = (القاعدة × الارتفاع) ÷ 2\n= (${fmt(nums[0])} × ${fmt(nums[1])}) ÷ 2\n= ${fmt(area)}\n\nالإجابة النهائية: ${fmt(area)} وحدة مربعة.`;}
  }
  if(/^(?:حل المعادلة:?|حل:?)/.test(raw)){
    const eq=raw.replace(/^(?:حل المعادلة:?|حل:?)/,"");
    if(eq.includes("="))return solveEquation(eq);
  }
  if(raw.includes("="))return solveEquation(raw.replace(/.*?(?=[\dسxX(])/ ,""));
  const expression=raw.replace(/^(?:احسب|ناتج|ما ناتج|كم يساوي)\s*/,"");
  if(/[+*/÷×−-]/.test(expression)&&/\d/.test(expression)){
    const v=parseLinear(expression);if(v.a!==0)throw new Error("هذه معادلة تحتوي على متغير. اكتبها باستخدام علامة = حتى أحلها.");
    return `لنحسب بالتدريج:\n${expression}\n= ${fmt(v.b)}\n\nالإجابة النهائية: ${fmt(v.b)}`;
  }
  if(/جمع الكسور|الكسور/.test(raw))return "لجمع كسرين مختلفي المقام:\n1. أوجد المضاعف المشترك الأصغر للمقامين.\n2. حوّل الكسرين إلى مقام موحّد.\n3. اجمع البسطين واترك المقام كما هو.\n\nمثال: ١/٢ + ١/٣ = ٣/٦ + ٢/٦ = ٥/٦.\n\nأرسل الكسرين بالأرقام لأحلّهما لك.";
  if(/^(?:مرحبا|السلام عليكم|أهلا|اهلا)/.test(raw))return "أهلاً بك! أنا مساعد محمد صلاح للرياضيات. أرسل مسألة رياضية وسأساعدك في حلها خطوة بخطوة.";
  throw new Error("أستطيع حالياً حل العمليات الحسابية والمعادلات الخطية البسيطة ومسائل مساحة المثلث. مثال: 2س + 4 = 14 أو 8 × 5 ÷ 2.");
}
function solveEquation(eq){
  const parts=eq.split("=");if(parts.length!==2)throw new Error("اكتب معادلة واحدة تحتوي على علامة =.");
  const left=parseLinear(parts[0]),right=parseLinear(parts[1]);
  const a=left.a-right.a,b=right.b-left.b;
  if(Math.abs(a)<1e-10){if(Math.abs(b)<1e-10)return "كل القيم تحقق هذه المعادلة.";throw new Error("لا يوجد حل لهذه المعادلة.");}
  const x=b/a;
  return `سنحل المعادلة خطوة بخطوة:\n${parts[0]} = ${parts[1]}\n\n1. نجمع حدود س في طرف والأعداد في الطرف الآخر.\n2. تصبح المعادلة: ${fmt(a)}س = ${fmt(b)}\n3. نقسم الطرفين على ${fmt(a)}.\n\nس = ${fmt(b)} ÷ ${fmt(a)}\nس = ${fmt(x)}\n\nالإجابة النهائية: س = ${fmt(x)}`;
}
app.post("/api/chat", (req,res)=>{
  try{
    const messages=req.body?.messages;
    if(!Array.isArray(messages)||!messages.length||messages.length>30)return res.status(400).json({error:"الرسائل غير صالحة."});
    const last=[...messages].reverse().find(m=>m?.role==="user");
    if(!last?.content)return res.status(400).json({error:"أرسل سؤالاً رياضياً أولاً."});
    res.json({answer:solve(String(last.content).slice(0,1000))});
  }catch(error){res.status(400).json({error:error.message||"تعذر حل المسألة."});}
});
app.listen(PORT,()=>console.log(`محمد صلاح للرياضيات يعمل على http://localhost:${PORT} (الوضع المجاني)`));
