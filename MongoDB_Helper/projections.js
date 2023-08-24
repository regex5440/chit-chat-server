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

const ProfileSearchResults = Object.freeze({
  _id: true,
  profile_type: true,
  firstName: true,
  lastName: true,
  avatar: true,
  username: true,
});

module.exports = { ProfileDataProjection, ProfileSearchResults };
