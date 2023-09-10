const ProfileDataProjection = Object.freeze({
  _id: 0,
  id: "$_id",
  profile_type: "$profile_type",
  firstName: "$firstName",
  lastName: "$lastName",
  status: "$status",
  about: "$about",
  avatar: "$avatar",
  last_active: "$last_active",
  username: "$username",
});

const ProfileSearchResults = Object.freeze({
  id: "$_id",
  profile_type: "$profile_type",
  firstName: "$firstName",
  lastName: "$lastName",
  avatar: "$avatar",
  about: "$about",
  username: "$username",
  status: "$status",
});

module.exports = { ProfileDataProjection, ProfileSearchResults };
