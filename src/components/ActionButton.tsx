import { Button } from "antd";
import { Dialog } from "antd-mobile";
import { ButtonColorType, ButtonProps } from "antd/es/button";

const ActionButton = ({
  onClick,
  confirmRequired,
  color,
  label,
  ...props
}: {
  onClick: () => void;
  confirmRequired?: boolean;
  color?: ButtonColorType;
  label: string;
} & ButtonProps) => {
  return (
    <Button
      {...props}
      onClick={() =>
        confirmRequired
          ? Dialog.confirm({
              content: "Open?",
              onConfirm: onClick,
            })
          : onClick()
      }
      variant="solid"
      color={color}
    >
      {label}
    </Button>
  );
};
export default ActionButton;
