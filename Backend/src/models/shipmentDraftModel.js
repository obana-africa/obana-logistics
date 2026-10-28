module.exports = (sequelize, DataTypes) => {
    /**
     * A booking somebody started and did not finish.
     *
     * Kept whole and unvalidated on purpose: a draft is a half-filled form,
     * and half a form does not satisfy the rules a real shipment must. It is
     * stored as the form's own shape so continuing is a matter of loading it
     * back, not of reconstructing it field by field.
     *
     * Nothing here is priced or quoted. A draft becomes a shipment only by
     * going through the booking that every other shipment goes through, which
     * is also why a price saved weeks ago cannot leak into one: the quote is
     * taken again when the draft is continued.
     */
    const ShipmentDraft = sequelize.define(
        'shipment_drafts',
        {
            id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
            /** Whose draft it is. A draft is private to the person who started it. */
            user_id: { type: DataTypes.INTEGER, allowNull: false },
            /** What they would call it in a list — derived if they do not name it. */
            label: { type: DataTypes.STRING, allowNull: true },
            /** The form, exactly as it was on screen. */
            form: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        },
        { timestamps: true, underscored: true },
    );
    return ShipmentDraft;
};
