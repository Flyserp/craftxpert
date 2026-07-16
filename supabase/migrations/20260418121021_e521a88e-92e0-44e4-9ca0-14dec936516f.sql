-- Dispute resolution audit (fires when status changes to resolved/closed)
CREATE OR REPLACE FUNCTION public.log_dispute_resolution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.status IN ('resolved', 'closed')
     AND COALESCE(OLD.status, '') <> NEW.status THEN
    INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, target_user_id, details)
    VALUES (
      auth.uid(),
      'dispute.' || NEW.status,
      'dispute',
      NEW.id::text,
      NEW.reported_user_id,
      jsonb_build_object(
        'subject', NEW.subject,
        'type', NEW.type,
        'priority', NEW.priority,
        'previous_status', OLD.status,
        'admin_notes', NEW.admin_notes
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_dispute_resolution ON public.disputes;
CREATE TRIGGER trg_log_dispute_resolution
AFTER UPDATE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.log_dispute_resolution();

-- Coupon create / delete audit
CREATE OR REPLACE FUNCTION public.log_coupon_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(), 'coupon.created', 'promo_coupon', NEW.id::text,
      jsonb_build_object(
        'code', NEW.code,
        'discount_type', NEW.discount_type,
        'discount_value', NEW.discount_value,
        'applicable_to', NEW.applicable_to,
        'max_uses', NEW.max_uses
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(), 'coupon.deleted', 'promo_coupon', OLD.id::text,
      jsonb_build_object(
        'code', OLD.code,
        'discount_type', OLD.discount_type,
        'discount_value', OLD.discount_value
      )
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_coupon_change ON public.promo_coupons;
CREATE TRIGGER trg_log_coupon_change
AFTER INSERT OR DELETE ON public.promo_coupons
FOR EACH ROW EXECUTE FUNCTION public.log_coupon_change();

-- Platform setting audit (logs key + old/new value, masks secrets)
CREATE OR REPLACE FUNCTION public.log_platform_setting_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old text;
  _new text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.value, '') = COALESCE(NEW.value, '') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_secret, OLD.is_secret, false) THEN
    _old := CASE WHEN OLD.value IS NULL THEN NULL ELSE '••••••' END;
    _new := CASE WHEN NEW.value IS NULL THEN NULL ELSE '••••••' END;
  ELSE
    _old := OLD.value;
    _new := NEW.value;
  END IF;

  INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'setting.' || lower(TG_OP),
    'platform_setting',
    COALESCE(NEW.id, OLD.id)::text,
    jsonb_build_object(
      'key', COALESCE(NEW.key, OLD.key),
      'old_value', _old,
      'new_value', _new,
      'is_secret', COALESCE(NEW.is_secret, OLD.is_secret, false)
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_platform_setting_change ON public.platform_settings;
CREATE TRIGGER trg_log_platform_setting_change
AFTER INSERT OR UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.log_platform_setting_change();