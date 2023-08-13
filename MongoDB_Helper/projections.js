const ProfileDataProjection = Object.freeze({
  id: "$_id",
  profile_type: "$profile_type",
  firstName: "$firstName",
  lastName: "$lastName",
  status: "$status",
  avatar: "$avatar",
  last_active: "$last_active",
  username: "$username",
});

module.exports = { ProfileDataProjection };
