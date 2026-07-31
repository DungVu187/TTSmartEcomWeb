const mongoose = require("mongoose");

const stationSchema = new mongoose.Schema({
  stationName: {
    type: String,
  },
  imgUrl: {
    type: String,
  },
  stationCode: {
    type: String,
    trim: true,
    required: true,
  },
  allowPublicSignup: {
    type: Boolean,
    default: true,
  },
  location: {
    type: String,
  },
  productId: [
    { type: String },
  ],
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

stationSchema.virtual("inviteCode").get(function () {
  return this.stationCode || "";
});

const Station = mongoose.models.Station || mongoose.model("Station", stationSchema);

const findStationByInviteCode = async (inviteCode) => {
  const trimmed = String(inviteCode).trim();
  return Station.findOne({ stationCode: trimmed });
};

module.exports = {
  Station,
  stationSchema,
  findStationByInviteCode,
};
