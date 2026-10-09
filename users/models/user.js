const mongoose = require("mongoose");
const { encrypt, decrypt, hashEmail } = require("../utils/fieldCrypto");

const daySchema = new mongoose.Schema({
  day: { type: Date, required: true },
  processed: { type: Number, default: 0, required: true },
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: false },
  
  email_encrypted: {
      type: String,
      required: function () {
        return this.type !== "anonymous";
      },
    },  

  email_hash: {
    type: String,
    required: function () {
      return this.type !== "anonymous";
    },
    unique: true,
    sparse: true,   // permite vários docs sem email_hash
    index: true,
  },
  
  password_hash: { type: String, required: false },
  type: {
    type: String,
    enum: ["anonymous", "free", "premium"],
    default: "free",
    required: true,
  },
  operations: { type: [daySchema], required: true, default: [] },
  // Idempotency keys for video refunds; internal and never sent to the client.
  video_refunds: { type: [String], default: [] },
});

// Change the daily counter and its refund key atomically in one document.
userSchema.statics.refundVideoOperation = function (userId, jobId, day, count) {
  return this.updateOne({ _id: userId, video_refunds: { $ne: jobId } }, [{ $set: {
    video_refunds: { $concatArrays: [{ $ifNull: ["$video_refunds", []] }, [jobId]] },
    operations: { $map: { input: "$operations", as: "op", in: {
      $cond: [{ $eq: ["$$op.day", day] },
        { $mergeObjects: ["$$op", { processed: { $max: [0, { $subtract: ["$$op.processed", count] }] } }] },
        "$$op"],
    } } },
  } }]);
};

// Virtual "email" para aceder ao valor desencriptado
userSchema.virtual("email")
  .get(function () {
    // se não houver email_encrypted (ex: anonymous), não tenta desencriptar
    if (!this.email_encrypted) return null;
    return decrypt(this.email_encrypted);
  })
  .set(function (plainEmail) {
    // se for limpar email ou não existir, limpa também os campos internos
    if (!plainEmail) {
      this.email_encrypted = undefined;
      this.email_hash = undefined;
      return;
    }

    this.email_encrypted = encrypt(plainEmail);
    this.email_hash = hashEmail(plainEmail);
  });

// Quando serializamos para JSON, incluir o email desencriptado e esconder o encriptado
userSchema.set("toJSON", {
  virtuals: true,
  transform: (_, ret) => {
    delete ret.email_encrypted;
    delete ret.email_hash;
    delete ret.password_hash;
    delete ret.video_refunds;
    return ret;
  },
});

module.exports = mongoose.model("user", userSchema);
