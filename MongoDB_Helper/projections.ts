const UserProfileProjection = Object.freeze({
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

const ProfileDataProjection = Object.freeze({
  _id: 0,
  id: "$_id",
  profile_type: "$profile_type",
  firstName: "$firstName",
  lastName: "$lastName",
  status: "$status.code",
  about: "$about",
  avatar: "$avatar",
  last_active: "$last_active",
  username: "$username",
});

const ProfileSearchResults = Object.freeze({
  _id: 0,
  id: "$_id",
  profile_type: "$profile_type",
  firstName: "$firstName",
  lastName: "$lastName",
  avatar: "$avatar",
  about: "$about",
  username: "$username",
  blocked_users: "$blocked_users",
});

export { UserProfileProjection, ProfileDataProjection, ProfileSearchResults };
